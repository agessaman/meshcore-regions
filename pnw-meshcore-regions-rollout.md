# Pacific Northwest MeshCore — Region Rollout

**An action guide for repeater operators — what to do, and when.**

**Phase 1 (Configure regions) opens: `DATE TBD`**
**Phase 2 (Strict region forwarding, optional) target: `DATE TBD`**
Last updated: `DATE TBD`

> [!NOTE]
> **The dates above are placeholders.** They will be filled in once the local mesh communities — Puget Mesh, PDX Mesh, Cascadia Mesh, Salish Mesh, and others — ratify a schedule. The *steps* below are stable; only the calendar markers (`DATE TBD`) are pending. You can complete Phase 1 at your own pace as soon as the rollout opens.

This is the action-oriented companion to the [Pacific Northwest MeshCore Region Strategy](../) document. The strategy document explains *what the regions are* and *why the scheme is designed the way it is*; this document tells you, as a repeater operator, *exactly what to configure*. Where you need the reasoning behind a step, this guide links back to the relevant section of the strategy document.

> [!NOTE]
> **Running a phone or client device, not a repeater?** Region *tags* are configured only on repeaters. As a client, your job is just to scope your outgoing traffic in the Companion app — see [Companion app: scope your channels](#step-4-companion-app--scope-your-channels) below, or the [Using Regions in the App](../explainer/#using-in-app) walkthrough. The rest of this document is for repeater operators.

---

## Why we're rolling out regions

The PNW mesh keeps growing, and every unscoped flood packet still reaches every repeater from Southern Oregon to Vancouver Island. Regions let a message travel only as far as it needs to: neighborhood chat stays in the neighborhood, statewide nets reach the state, and only genuinely region-wide traffic crosses the whole mesh. The result is less congestion and a more reliable mesh for everyone.

Adopting regions is **additive and backward compatible**. Turning on region tags does not cut anyone off — unscoped traffic keeps flooding as it does today (via the firmware root region `*`). Regions only *add* the ability to scope traffic more tightly. That is why Phase 1 is safe to adopt at any pace, and why the breaking-change step (Phase 2) is **optional** and deferred.

---

## The rollout in a nutshell

| Phase | When | What you do |
|---|---|---|
| **Phase 1 — Configure regions** | From `DATE TBD`, at your own pace | Steps 1–5 below: update firmware, add your region tags, set a default region, scope your Companion channels, and verify. |
| *(General mesh hygiene)* | Anytime | Step 6: advert-interval and loop-detection tuning. Not region-specific, but encouraged alongside the rollout. |
| **Phase 2 — Strict forwarding** | Target `DATE TBD`, **optional** | Step 7: `region denyf *` — your repeater stops forwarding unscoped traffic. A breaking change; adopt only when your local mesh is ready. |

```
Phase 1  ─ Configure regions (safe, additive, do anytime) ──┐
   1  Update firmware                                        │
   2  Add region tags                                        │
   3  Set default region                                     │
   4  Scope Companion channels                               │
   5  Verify with Discover Regions                           │
   6  (Optional) General mesh hygiene                        │
                                                             ▼
Phase 2  ─ Strict region forwarding (OPTIONAL, coordinated) ──
   7  region denyf *   ← breaking change; only when ready
```

---

## What you'll set, at a glance

**On your repeater(s):**

| Item | Recommendation |
|---|---|
| Minimum firmware | **1.10.0** (regions work at all); **1.15.0+ recommended** so `region put` enables flooding automatically |
| Region tags | Your **full ancestry** down to your local tag (e.g. `west`, `pnw`, `wa`, `w-wa`, `sea`) — use the [Config Generator](../config/) |
| Default region | Your everyday local tag (scopes your repeater's own adverts) |
| Strict forwarding | `region denyf *` — **Phase 2, optional**, do not enable early |

**On your Companion(s):**

| Item | Recommendation |
|---|---|
| Channel scopes | Scope each channel to how far the conversation should travel (`sea`/`pdx` local, `wa`/`or` statewide, `pnw` region-wide) |
| Default scope | Your local metro tag (e.g. `sea`, `pdx`) — tags flood packets on unscoped channels |

---

## Phase 1 — Configure regions

Steps 1–5 are the whole rollout. They are safe to do as soon as Phase 1 opens — nothing here drops anyone's traffic. The fastest path through Steps 2 and 3 is the [Config Generator](../config/), which builds your exact command chain from your location; the steps below show what it produces and explain it so you can verify or adjust.

### Step 1 — Update your firmware

Make sure your repeater is on current MeshCore firmware before configuring regions.

- **Minimum: 1.10.0.** Older firmware ignores transport codes entirely and cannot participate in regions.
- **Recommended: 1.15.0 or later.** On 1.15.0+, each `region put` enables flooding for that region automatically — the examples below assume this.

<aside class="gh-alert gh-alert-warning" data-alert="warning" data-fw-only="1.14"><p class="gh-alert-title">Warning</p><div class="gh-alert-body"><p>On <strong>firmware 1.14.0</strong> and earlier <strong>1.14.x</strong>, <code>region put</code> does <strong>not</strong> enable flooding on its own. After each <code>region put</code>, you must also run <strong><code>region allowf &lt;name&gt;</code></strong> for that region. The strategy document's <a href="../#repeater-configuration">Repeater Configuration</a> section covers this. Updating to 1.15.0+ avoids the extra step.</p></div></aside>

> [!TIP]
> **New in 1.16.0:** a single-line `region def` command (MeshCore [PR #2540](https://github.com/meshcore-dev/MeshCore/pull/2540)) lets you load an entire region hierarchy in one message instead of a chain of `region put` commands — more reliable, since a single dropped message can't leave you half-configured. The CLI examples on the rendered docs include a **firmware toggle** (1.14 / 1.15 / 1.16) that now defaults to **1.16**; switch it to **1.15** or **1.14** if you're on older firmware.

### Step 2 — Add your region tags

Your repeater must carry **every tag in its ancestry**, from the root down to your local area. Region matching is per-tag, not hierarchical: carrying `wa` does *not* automatically forward `sea` traffic — you must carry each tag explicitly. (See [The hierarchy is administrative, not functional](../#the-hierarchy-is-administrative-not-functional) for why.)

**Easiest:** open the [Config Generator](../config/), pick your area, and copy the generated commands straight to your repeater.

**Manual example — a Seattle metro repeater:**

```
region put west
region put pnw west
region put wa pnw
region put w-wa wa
region put sea w-wa
region save
```

Tags carried: `west`, `pnw`, `wa`, `w-wa`, `sea`.

**In the app instead of the CLI:** open the repeater's **Manage Regions** screen and, for each tag in your ancestry, add the tag and turn on **Allow Flood**. Add them from the root down (`west`, then `pnw`, then `wa`, …) so each tag's parent already exists. (The parent column is display-only — it organizes the list but doesn't change forwarding — so the order is for tidiness, not correctness.)

Find the chain for your own area in the strategy document's [Repeater Configuration](../#repeater-configuration) examples (Portland, Spokane, Boise, Victoria, Flathead, border repeaters, and more), or generate it with the [Config Generator](../config/).

> [!IMPORTANT]
> **Carry your full ancestry even if your range is short.** A neighborhood node should carry the same `west` / `pnw` / state / metro chain as a backbone node. Stripping tags doesn't make your node "lighter" — it just punches a hole in coverage for everyone who reaches the mesh through you. See [Always carry your full ancestry](../#always-carry-your-full-ancestry).

> [!NOTE]
> **Cross-border community tags** (`inw` for the Inland Northwest, `pdx` for Portland metro) sit *alongside* your state ancestry, not in place of it — add them with their own `region put` if your node serves that community. See [Cross-Border Metro Regions](../#cross-border-metro-regions).

### Step 3 — Set your default region

The **default region** is attached to the packets your repeater originates itself — chiefly its own advertisements. Setting it scopes your adverts so they don't flood the entire mesh, cutting background noise. It does **not** affect which traffic you forward; that is governed entirely by the tags from Step 2.

```
region default sea
region save
```

(Replace `sea` with your own everyday local tag.)

**In the app instead of the CLI:** on the **Manage Regions** screen, tap the **⋮** menu next to your local tag and choose **Set as default**.

**Choosing your default:**
- **Neighborhood / urban nodes:** use your **local metro tag** (`sea`, `pdx`, `geg`, …). Your neighbors carry that tag, so your adverts still reach them — they just don't flood three states away.
- **Backbone / high-site linkers:** use a **broader tag** matching the traffic you wish to carry — often your **state** (`wa`, `or`) or `pnw`. A linker that announces itself only to one metro defeats the purpose of being a linker. See [Backbone and High-Site Repeaters](../#backbone-and-high-site-repeaters).

### Step 4 — Companion app: scope your channels

Tags on the repeater decide what your node *forwards*; the Companion app decides what scope is *attached to the messages you send*. Both halves are needed for regions to actually reduce traffic.

In the MeshCore Companion app:

**1. Scope each channel (the important part):**

1. Open the channel you want to scope.
2. Tap its **⋮** menu and choose **Set Region Scope**.
3. Type the region tag and confirm. Match the scope to how far the conversation should travel: local public chat → your metro tag (`sea`, `pdx`); statewide → `wa` / `or`; PNW-wide nets → `pnw`; mesh-wide announcements only → `west`.
4. The scope now appears as a **Region: `sea`** subtitle under the channel name. You can change or remove it any time through the same **⋮** menu.

Repeat for every channel you use.

**2. Set an app-wide default scope:**

Open **Settings → Experimental Settings → Default Region Scope** and set your everyday local tag (e.g. your metro). Flood packets you send, both channel messages and adverts, with no explicit scope are then still tagged with this default instead of flooding the whole mesh.

> [!TIP]
> **Scope as narrowly as the conversation warrants.** Metro scope is the right default for local chat — don't reach for `pnw` or `west` for a neighborhood conversation. See [Choosing a channel scope](../#choosing-a-channel-scope).

A full walkthrough with screenshots is in [Using Regions in the App](../explainer/#using-in-app).

### Step 5 — Verify with Discover Regions

Confirm your tags are live and that your neighbors are configured too.

1. From the main screen, tap the **⋮** menu (top-right).
2. Choose **Tools → Discover Regions**.
3. The app scans the mesh and lists every region tag carried by repeaters it can hear.

- You should see your own tags in the list.
- If a neighbor you expect to share a scope with isn't carrying it, your scoped traffic won't reach them — point them at this guide.

### Step 6 — (Optional) General mesh hygiene

These are **not** region settings, but they reduce congestion and pair well with the rollout. Coordinate exact values with your local group.

- **Lengthen your flood advert interval.** Frequent flood adverts are a leading cause of congestion. A **flood advert interval of at least 70 hours** is the suggested PNW default; optionally keep zero-hop adverts short (e.g. 8+ hours) for local neighbor discovery.
- **Enable loop detection** (firmware 1.14.0+). This rejects flood packets that appear to be circulating, which contains packet storms from a misbehaving node:

  ```
  set loop.detect minimal
  ```

  Options are `off`, `minimal`, `moderate`, `strict`; `minimal` is a safe starting point that catches clear loops without false positives on legitimate traffic.

---

## Phase 2 — Strict region forwarding (optional)

> [!WARNING]
> **This is a breaking change, and it is optional.** Phase 1 is safe for everyone. Phase 2 changes your repeater so it **silently drops flood traffic that carries no region scope**. Any neighbor who hasn't configured region scoping (Step 4) can no longer pass traffic through your repeater. Do not enable this until your local mesh has broadly adopted Phase 1.

By default the PNW scheme stays backward compatible: unscoped traffic keeps flooding via the root region `*`. Strict forwarding turns that off on your repeater:

```
region denyf *
region save
```

From the app UI: in **Manage Regions**, set **Deny Flood** on **Packets without region set**.

**When to consider enabling it:**
- Your immediate neighbors have all completed Phase 1 and their channels are scoped.
- Your local community has agreed on a coordinated date (the `DATE TBD` target above), rather than flipping it solo.
- You understand that unscoped nodes will be cut off through your repeater — which is the point: it creates pressure to finish configuring, and it's what turns the mesh into clean regional zones.

**To revert** (re-allow unscoped flood):

```
region allowf *
region save
```

> [!IMPORTANT]
> **Do not enable strict forwarding during Phase 1.** Enabling `region denyf *` before your local mesh has adopted regions will drop your neighbors' traffic and fragment the mesh during the transition.

---

## Checklist

**Phase 1 — Configure regions:**

- [ ] **Step 1:** Firmware on 1.10.0+ (1.15.0+ recommended)
- [ ] **Step 2:** Region tags added — full ancestry for your area (`region put …` / [Config Generator](../config/))
- [ ] **Step 3:** Default region set (`region default <your local tag>`)
- [ ] **Step 4:** Companion channels scoped (Set Region Scope) + app-wide Default Region Scope set
- [ ] **Step 5:** Discover Regions shows your tags live; neighbors configured
- [ ] **Step 6 (optional):** Flood advert interval lengthened; `set loop.detect minimal`

**Phase 2 — Strict forwarding (optional, coordinated):**

- [ ] Local mesh has broadly completed Phase 1
- [ ] Community date agreed
- [ ] `region denyf *` + `region save` applied

---

## Troubleshooting

**My scoped messages aren't arriving.**
The neighbor repeaters between you and your destination may not carry the tag you scoped to. Region matching is per-tag — if a repeater in the path doesn't carry that exact tag, it won't forward. Temporarily clear the scope on the channel (in the Companion app); if the message gets through unscoped, it confirms a region misconfiguration in your local mesh. Use **Tools → Discover Regions** to see which tags neighbors actually carry, and have them complete [Step 2](#step-2--add-your-region-tags).

**Discover Regions doesn't show a tag I expect.**
Re-check your `region put` chain on the repeater and confirm you ran `region save`. On firmware 1.14.x, confirm you also ran `region allowf <name>` for each tag.

**I enabled strict forwarding and now neighbors can't reach me.**
Running `region denyf *` is Phase 2, and dropping unscoped traffic is its expected effect on nodes that haven't configured regions. If you enabled it too early, revert with `region allowf *` then `region save`, and wait until your local mesh has completed Phase 1.

---

## Where to get help

- [**Config Generator**](../config/) — build your exact `region` command chain from your location.
- [**Using Regions in the App**](../explainer/#using-in-app) — Companion app walkthrough with screenshots.
- [**Region Strategy document**](../) — the full scheme, rationale, and every area's configuration example.
- **Discover Regions** — in the Companion app: **Tools → Discover Regions**
- **Your local mesh community** — Puget Mesh, PDX Mesh, Cascadia Mesh, Salish Mesh, and other regional groups. Local area tags (the most-local level) should be confirmed with the community that operates there.
