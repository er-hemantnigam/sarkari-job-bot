# Sarkari Job Bot — System Design

A Telegram bot that ingests Indian government job notifications from RSS feeds and
HTML pages, categorizes them, matches them to user preferences, and pushes alerts
with tier-based delivery delays.

---

## 1. High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Railway worker (1 process)                  │
│                                                                    │
│   ┌──────────────┐         ┌─────────────────────────────────┐     │
│   │  Telegraf    │         │   node-cron scheduler           │     │
│   │  long-poll   │         │                                 │     │
│   │  (commands)  │         │   • alerts        every  5 min  │     │
│   └──────┬───────┘         │   • RSS pull      every 30 min  │     │
│          │                 │   • Site scrape   every  2 hrs  │     │
│          │                 │   • Daily jobs    00:05 IST     │     │
│          │                 └────────────┬────────────────────┘     │
│          ▼                              ▼                          │
│   ┌──────────────────────────────────────────────────┐             │
│   │   Domain modules                                 │             │
│   │   - commands/*       (bot UX layer)              │             │
│   │   - engine/matcher   (user × job filtering)      │             │
│   │   - engine/categorizer (keyword tagging)         │             │
│   │   - engine/alertSender (delivery)                │             │
│   │   - scraper/*        (RSS + HTML ingestion)      │             │
│   └────────────────────────┬─────────────────────────┘             │
└────────────────────────────┼───────────────────────────────────────┘
                             │ Mongoose
                             ▼
                  ┌──────────────────────┐         ┌────────────────┐
                  │   MongoDB Atlas      │         │  Telegram API  │
                  │   - users            │◄────────┤  (send msg,    │
                  │   - jobs             │         │   forward      │
                  │   - subscriptions    │         │   screenshots) │
                  └──────────────────────┘         └────────────────┘

                  ┌──────────────────────┐
                  │ External sources     │
                  │ - 4 RSS feeds        │  (pulled by rssParser)
                  │ - ssc.gov.in         │  (scraped by siteScraper)
                  │ - freejobalert.com   │  (scraped by siteScraper)
                  └──────────────────────┘
```

One Node process does everything (bot, scraping, alerting, cron). Single-instance
by design — `node-cron` is in-memory, so horizontal scaling would double-fire crons.

---

## 2. Code layout

```
src/
├── index.js              entrypoint: connect DB, register commands, launch bot, start cron
├── bot.js                Telegraf instance + session middleware
├── config/
│   └── constants.js      CATEGORIES, STATES, QUALIFICATIONS, PLAN_LIMITS, PRICES
├── models/
│   ├── db.js             mongoose.connect()
│   ├── User.js           one row per Telegram user
│   ├── Job.js            one row per unique job notification
│   └── Subscription.js   one row per payment attempt
├── commands/
│   ├── start.js          /start + new-member welcome
│   ├── categories.js     /categories inline keyboard
│   ├── settings.js       /settings (state + qualification)
│   ├── myplan.js         /myplan
│   ├── subscribe.js      /subscribe + photo handler
│   ├── activate.js       /activate (admin only)
│   ├── pause.js          /pause + /resume
│   └── help.js           /help
├── engine/
│   ├── categorizer.js    keyword → category/state/qualification/lastDate/vacancies
│   ├── matcher.js        does user u want job j? is delay window passed?
│   └── alertSender.js    format + send + track notifiedUsers
├── scraper/
│   ├── rssParser.js      4 feeds → categorize → upsert
│   └── siteScraper.js    cheerio scrape → categorize → upsert
├── scheduler/
│   ├── index.js          cron schedules
│   └── dailyJobs.js      midnight tasks
└── utils/
    └── hash.js           MD5(title|link|source) for dedup
```

---

## 3. Data model

### User
```
telegramId      number, unique     ← primary external key
username        string
firstName       string
plan            'free' | 'basic' | 'premium'
expiresAt       Date | null
categories      string[]            ← user preference
states          string[]            ← user preference
qualification   string              ← user preference
isPaused        boolean
isActive        boolean             ← false if user blocked the bot
alertsToday     number              ← free-tier daily cap counter
lastAlertDate   'YYYY-MM-DD'        ← used to detect day rollover
joinedAt        Date
```

### Job
```
title           string
link            string
source          string              ← e.g. 'rojgarresult', 'ssc.gov.in'
category        string              ← from categorizer
state           string              ← from categorizer
qualification   string              ← from categorizer
lastDate        string | null       ← regex-extracted DD/MM/YYYY
vacancies       string | null       ← regex-extracted count
hash            string, unique      ← MD5(title|link|source), dedup key
notified        boolean             ← true once all delay tiers have processed it
notifiedAt      Date
notifiedUsers   number[]            ← telegramIds already sent (per-user dedup)
foundAt         Date                ← used to compute delay windows
```

### Subscription
```
telegramId      number
plan            'basic' | 'premium'
amount          number              ← INR
paymentMethod   'UPI'
paymentRef      string | null
screenshotId    string | null       ← Telegram file_id of payment screenshot
status          'pending' | 'active' | 'expired' | 'cancelled'
startDate       Date
endDate         Date
createdAt       Date
```

---

## 4. Subscription tiers

| Tier    | Daily alert cap | Delivery delay | Multi-category | Last-date reminders | Admit card | Results |
|---------|----------------|----------------|----------------|---------------------|------------|---------|
| free    | 3              | 6 hours        | no             | no                  | no         | no      |
| basic   | unlimited      | 30 minutes     | yes            | no                  | yes        | no      |
| premium | unlimited      | instant        | yes            | yes                 | yes        | yes     |

Source of truth: `PLAN_LIMITS` in [src/config/constants.js](src/config/constants.js).

---

## 5. Data flow — ingestion

```
   ┌────────────────┐  HTTP   ┌─────────────────┐
   │  RSS feed (x4) │────────►│   rssParser     │
   └────────────────┘         │  parseURL       │
                              └────────┬────────┘
                                       │
   ┌────────────────┐  HTTP   ┌────────▼────────┐
   │ govt HTML page │────────►│  siteScraper    │
   └────────────────┘         │  cheerio.load   │
                              └────────┬────────┘
                                       │ {title, link, source, description}
                                       ▼
                              ┌─────────────────┐
                              │  categorizeJob  │  ← keyword tagging
                              └────────┬────────┘
                                       │ + category, state, qual, lastDate, vacancies
                                       ▼
                              ┌─────────────────┐
                              │  jobHash (MD5)  │  ← dedup key
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────────────────────────┐
                              │  Job.updateOne({hash},              │
                              │    {$setOnInsert: {...}},           │
                              │    {upsert: true})                  │
                              └─────────────────────────────────────┘
```

Key invariant: **`$setOnInsert`, never `$set`** — once a job exists in the DB it is
immutable. If we re-scrape the same item tomorrow, `foundAt` stays the same so the
delay windows don't reset, and `notifiedUsers` is preserved.

---

## 6. Data flow — alert delivery (the interesting bit)

The challenge: same job needs to reach Premium *immediately*, Basic in *30 min*,
Free in *6 hrs*. A single `notified: boolean` would either skip Basic/Free (if set
on first send) or starve Premium (if held until 6 hrs).

**Solution:** per-user delivery log `Job.notifiedUsers: [telegramId]` + a "fully
processed" flag `Job.notified` that flips only when the job is older than the
longest delay window.

```
Every 5 min, alertSender.processPendingJobs():

  jobs = Job.find({ notified: false }).sort(foundAt).limit(100)
  users = User.find({ isActive: true, isPaused: false })

  for each job j:
      for each user u:
          if u.telegramId ∈ j.notifiedUsers:  skip   (already sent)
          if not matchesUser(u, j):           skip   (wrong category/state/qual)
          if not isJobReady(u, j):            skip   (delay window not met)
          if not canSendNow(u):               skip   (daily cap hit)

          sendAlert(u, j)
          if ok:
              j.notifiedUsers.push(u.telegramId)
              u.alertsToday += 1   (or reset to 1 if day rolled over)

      if (now - j.foundAt) ≥ MAX_DELAY_MINUTES:
          j.notified = true
      save(j)
```

**Tier-by-tier walkthrough for a single job at t=0:**

| Cron tick | Job age | Premium user        | Basic user          | Free user           |
|-----------|---------|---------------------|---------------------|---------------------|
| t=5 min   | 5 min   | ✅ sent (instant)   | ⏳ delay not met    | ⏳ delay not met    |
| t=30 min  | 30 min  | skip (in list)      | ✅ sent             | ⏳ delay not met    |
| t=355 min | 355 min | skip                | skip                | ⏳ still waiting    |
| t=365 min | 365 min | skip                | skip                | ✅ sent. job.notified=true |

**Failure modes:**
- Telegram returns `403` → user blocked bot → `user.isActive = false`, stop trying.
- Telegram returns any other error → logged, retried on next cron tick.
- No rate limiting today. Telegram allows ~30 msg/sec; sequential `await` plus a
  small user base keeps us comfortably under.

---

## 7. Data flow — subscription

```
User                Bot              MongoDB           Admin (you)
 │                   │                  │                  │
 │ /subscribe        │                  │                  │
 ├──────────────────►│                  │                  │
 │   plan options    │                  │                  │
 │◄──────────────────┤                  │                  │
 │                   │                  │                  │
 │ tap "Premium"     │                  │                  │
 ├──────────────────►│                  │                  │
 │   UPI details +   │ session.step =   │                  │
 │   "send screenshot"│ 'awaiting_screenshot'              │
 │◄──────────────────┤                  │                  │
 │                   │                  │                  │
 │ pays via UPI app  │                  │                  │
 │ sends screenshot  │                  │                  │
 ├──────────────────►│                  │                  │
 │                   │ Subscription.    │                  │
 │                   │ create(pending)  │                  │
 │                   ├─────────────────►│                  │
 │                   │                  │                  │
 │                   │ forwardPhoto + caption with         │
 │                   │ /activate command                   │
 │                   ├────────────────────────────────────►│
 │  "received"       │                  │                  │
 │◄──────────────────┤                  │                  │
 │                   │                  │                  │
 │                   │                  │   you verify UPI │
 │                   │                  │   /activate <id> │
 │                   │◄─────────────────┼──────────────────┤
 │                   │ User.update      │                  │
 │                   │ {plan, expiresAt}│                  │
 │                   ├─────────────────►│                  │
 │                   │ Subscription     │                  │
 │                   │ status=active    │                  │
 │                   ├─────────────────►│                  │
 │ "Plan active!"    │                  │                  │
 │◄──────────────────┤                  │                  │
```

Manual activation is the trade-off: avoids payment-gateway integration cost but
introduces a human-in-the-loop step. Acceptable at low volume.

---

## 8. Cron schedule

| Cron expr           | Task                          | What it does                                            |
|---------------------|-------------------------------|---------------------------------------------------------|
| `*/5 * * * *`       | `processPendingJobs`          | Send alerts (the loop above)                            |
| `*/30 * * * *`      | `fetchAllRss`                 | Pull 4 RSS feeds                                        |
| `0 */2 * * *`       | `scrapeAllSites`              | Scrape SSC + FreeJobAlert HTML                          |
| `5 0 * * *` (IST)   | `runDailyJobs`                | Reset `alertsToday`, downgrade expired, send reminders  |

Daily job substeps (in [src/scheduler/dailyJobs.js](src/scheduler/dailyJobs.js)):
1. `resetDailyCounters` — set `alertsToday = 0` where `lastAlertDate ≠ today`
2. `downgradeExpired` — move users past `expiresAt` back to `free`, mark subs `expired`
3. `sendExpiryReminders` — notify users whose plan expires in ~2 days
4. `sendLastDateReminders` — premium-only, for jobs whose `lastDate` is tomorrow

---

## 9. Session state

Telegraf in-memory session ([src/bot.js](src/bot.js)) holds only short-lived flow
state:

```js
{ step: 'awaiting_screenshot' | null, pendingPlan: 'basic' | 'premium' | null }
```

This is **lost on restart**, by design. If a user is mid-`/subscribe` when the
worker reboots, they'll need to re-tap the plan button. Acceptable for a flow
measured in seconds.

All durable state (preferences, plan, alert counters, subscriptions) lives in
MongoDB.

---

## 10. Configuration & secrets

Single source: `.env` (and Railway dashboard env vars in production).

| Var             | Purpose                                              |
|-----------------|------------------------------------------------------|
| `BOT_TOKEN`     | Telegram bot token from @BotFather                   |
| `MONGODB_URI`   | Atlas connection string                              |
| `GROUP_ID`      | Optional: target group for broadcast (not used yet)  |
| `ADMIN_CHAT_ID` | Your personal Telegram numeric ID (for screenshots + /activate) |
| `UPI_ID`        | UPI address shown to users for payment               |
| `BASIC_PRICE`   | Override default ₹49                                 |
| `PREMIUM_PRICE` | Override default ₹99                                 |
| `NODE_ENV`      | `development` locally, `production` on Railway       |

---

## 11. Deployment topology

```
GitHub repo  ──►  Railway (auto-deploy on push)
                  ├─ Procfile: worker: node src/index.js
                  ├─ env vars from dashboard
                  └─ single dyno, long-polling Telegraf

MongoDB Atlas (free tier)
  └─ IP whitelist: 0.0.0.0/0  (Railway IPs aren't static)
```

No webhook server, no load balancer, no Redis. The whole system is one Node
process talking to MongoDB and the Telegram API.

---

## 12. Known limitations & future work

**Scraper brittleness.** `ssc.gov.in` and `freejobalert.com` use broad CSS
selectors with keyword filtering. If their HTML changes, expect noise or empty
results. Mitigation: tighten selectors per site after observing real data.

**Single-instance only.** Crons are in-memory. Going multi-instance requires
either (a) a distributed lock (Redis) or (b) extracting cron to a separate worker.

**No rate limiting on outbound sends.** Telegram allows ~30 msg/sec. At thousands
of users × multiple new jobs, add `await sleep(40)` between sends or batch with
`Promise.all` chunks.

**No retries on transient failures.** A network blip drops one (user, job)
delivery; next cron tick picks it up because `notifiedUsers` doesn't include them.
Acceptable. If a user is unreachable for >6 hrs the job will be marked
`notified=true` and they'll miss it permanently.

**Categorization is keyword-based.** Good enough for SSC/Railway/etc. but will
miss niche notifications. Future: small LLM call per job (cost: ~₹0.01 each).

**Manual subscription activation.** Doesn't scale past ~50 payments/day. Future:
Razorpay webhook → auto-activate.

**No analytics.** No tracking of which jobs converted to clicks, which users
churn, which categories are most-used. Future: log to a separate collection.
