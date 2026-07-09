# Pacific Northwest MeshCore Region Strategy

## Overview

This document proposes a region naming scheme for the Pacific Northwest MeshCore mesh network, spanning from Southern Oregon through the Puget Sound region of Washington State to Vancouver and Victoria in British Columbia, east across the Cascades to the Inland Empire, and into northwest Montana's Flathead Valley (geologically part of Cascadia). The scheme is designed for use with MeshCore's region filtering system (firmware 1.10.0+), which uses hierarchical region tags on repeaters and transport code scoping on messages to control flood propagation.

The scheme prioritizes short, flat, human-readable names. The parent/child hierarchy is enforced by `region put` commands, not by encoding structure into the names themselves.

> [!NOTE]
> **Using a phone or client device and not running a repeater?** Region *tags* are configured only on repeaters, so most of this document — everything from [Repeater Configuration](#repeater-configuration) onward — doesn't apply to you. What you control is the **region scope on your outgoing traffic**, set in the Companion app: per channel via **Set Region Scope**, or for all flood packets via **Settings → Experimental Settings → Default Region Scope**. See [Using Regions in the App](explainer/#using-in-app). The rest of this document is reference material for repeater operators.

## Design Principles

- **Short names**: Region names are purely administrative — they never appear in flood packets. But shorter names are easier to type in CLI, easier to remember, and conserve the 172-byte budget in the regions response payload. Three letters or fewer where possible.
- **MSA-scale regions**: The third level corresponds roughly to OMB Metropolitan Statistical Areas rather than individual counties. People don't segment their daily lives by county lines, and the mesh shouldn't either. The Seattle-Tacoma-Bellevue MSA (King, Pierce, Snohomish counties) is one region: `sea`.
- **Flat naming**: `west`, `pnw`, `wa`, `sea` — not a complex string like `west-pnw-wa-sea` or `noam-usa-wa-sea`. The hierarchy lives in the parent relationships, not the strings.
- **Cross-border pragmatism**: Portland straddles OR/WA — it lives under `or`, and Clark County WA repeaters dual-carry `pdx` and `wa`. The Inland Empire straddles WA/ID and uses the same dual-carry pattern. Vancouver BC uses community-established region tags (`swbc`, `vanisle`, `southisland`, `salishmesh`) rather than IATA codes to reflect the actual geographic communities that have formed on the mesh.

## Technical Constraints


| Constraint | Value |
|---|---|
| Characters allowed | Lowercase a-z, 0-9, hyphen |
| Max name length | 29 bytes (UTF-8) |
| Max regions per repeater | 32 |
| Regions response budget | 172 bytes (comma-separated names) |
| Region names must be | Unique within the mesh |

---

## Proposed Region Hierarchy

```
west                            Entire mesh (Western US / SW Canada)
    pnw                         Pacific Northwest
        wa                      Washington State
            w-wa                Western Washington
                sea             Seattle / Tacoma / Bellevue (King, Pierce, Snohomish)
                oly             Olympia / Lacey / Tumwater (Thurston)
                kit             Kitsap / Bremerton / Silverdale
                grh             Grays Harbor / WA coast
                bvs             Skagit Valley / Mount Vernon / Anacortes
                bli             Bellingham / Whatcom County
            sw-wa               Southwest Washington
                cls             Centralia / Chehalis (Lewis)
                kls             Kelso / Longview (Cowlitz)
            c-wa                Central Washington
                ykm             Yakima (Yakima)
                eat             Wenatchee (Chelan)
                eln             Ellensburg (Kittitas)
                mwh             Moses Lake (Grant)
            e-wa                Eastern Washington
                geg             Spokane metro
            se-wa               Southeastern Washington
                alw             Walla Walla (Walla Walla)
                puw             Pullman (Whitman, Asotin, Garfield)
                psc             Tri-Cities / Pasco / Kennewick / Richland (Benton, Franklin)
        ie                      Inland Empire (Spokane WA + N. Idaho panhandle)
            palouse             Palouse (Pullman WA + Moscow/Lewiston/Clearwater ID, cross-border)
            lc                  Lewiston / Clarkston (Nez Perce Co. ID + Asotin Co. WA, cross-border, proposed)
        or                      Oregon
            pdx                 Portland metro (OR + Clark County WA)
            wv                  Willamette Valley
                sle             Salem / Keizer (Marion, Polk)
                cvo             Corvallis / Albany (Benton, Linn)
                eug             Eugene / Springfield (Lane)
            s-or                Southern Oregon
                mfr             Medford / Ashland (Jackson)
                rbg             Roseburg (Douglas)
                lmt             Klamath Falls (Klamath)
            coast-or            Oregon Coast
                onp             Newport / Lincoln City (Lincoln)
                ast             Astoria / Seaside (Clatsop)
                otk             Tillamook (Tillamook)
                oth             North Bend / Coos Bay (Coos)
            c-or                Central Oregon
                ben             Bend / Redmond (Deschutes)
                pdt             Pendleton (Umatilla)
                bke             Baker City (Baker)
        id                      Idaho (Moscow / Lewiston / Clearwater carry id directly — no dedicated metro tag)
            boi                 Boise metro
            cda                 Coeur d'Alene / N. Idaho panhandle
        mt                      Montana (partial — statewide expansion planned)
            fca                 Flathead Valley / Kalispell / Glacier (Glacier Park Intl)
        bc                      British Columbia (southern)
            swbc                Southwest BC / Lower Mainland
            vanisle             Vancouver Island
                southisland     South Vancouver Island / Victoria
            salishmesh          Salish Sea / Gulf Islands
    ca                          California (future)
        nca                     Northern California
        bay                     Bay Area
        sca                     Southern California
```

### Name Rationale

| Tag | Source | Notes |
|---|---|---|
| `west` | Abbreviation | Western — top level for the entire mesh |
| `pnw` | Abbreviation | Pacific Northwest — well understood regionally |
| `wa`, `or`, `bc`, `id` | Postal / standard | State and province abbreviations |
| `sea` | IATA | Seattle-Tacoma International — universally recognized |
| `pdx` | IATA | Portland International — iconic, avoids OR/WA ambiguity |
| `ie` | Abbreviation | Inland Empire — established regional identity for the Spokane–CdA corridor |
| `palouse` | Community name | Palouse — cross-border sub-region of `ie` shared by Pullman, WA and Moscow, ID |
| `lc` | Abbreviation | Lewiston / Clarkston — cross-border sub-region of `ie` for the Nez Perce Co. ID / Asotin Co. WA valley; not to be confused with "Lower Columbia" (the `ast`/`kls` corridor) |
| `swbc` | Abbreviation | Southwest BC / Lower Mainland — community-established name reflecting the Metro Vancouver area |
| `vanisle` | Abbreviation | Vancouver Island — full island region |
| `southisland` | Abbreviation | South Vancouver Island / Victoria — established community sub-region of `vanisle` |
| `salishmesh` | Community name | Salish Sea / Gulf Islands — named after the active Salish Mesh community in the Gulf Islands |
| `bli` | IATA | Bellingham International |
| `oly` | Abbreviation | Olympia — IATA code `OLM` exists but `oly` is more recognizable as a short form of the city name |
| `kit` | Abbreviation | Kitsap — Bremerton National Airport IATA code is `PWT`, but `kit` better represents the broader Kitsap Peninsula community |
| `w-wa` | Abbreviation | Western Washington |
| `sw-wa` | Abbreviation | Southwest Washington |
| `c-wa` | Abbreviation | Central Washington |
| `e-wa` | Abbreviation | Eastern Washington — now the Spokane-and-points-north branch, see `se-wa` |
| `se-wa` | Abbreviation | Southeastern Washington — community-established identifier adopted by Walla Walla and the Tri-Cities; see the [ShrubSteppe SE-WA region proposal](https://wiki.shrubsteppe.net/Proposed%20Region%20Codes) |
| `bvs` | IATA | Skagit Regional Airport (Burlington) |
| `grh` | Abbreviation | Grays Harbor |
| `cls` | IATA | Chehalis-Centralia Airport |
| `kls` | IATA | Kelso-Longview (Southwest Washington Regional) |
| `ykm` | IATA | Yakima Air Terminal |
| `eat` | IATA | Pangborn Memorial Airport (Wenatchee) |
| `eln` | IATA | Bowers Field (Ellensburg) |
| `mwh` | IATA | Grant County International (Moses Lake) |
| `geg` | IATA | Spokane International Airport (Geiger Field) |
| `alw` | IATA | Walla Walla Regional Airport |
| `puw` | IATA | Pullman-Moscow Regional Airport |
| `psc` | IATA | Tri-Cities Airport (Pasco) — Pasco / Kennewick / Richland |
| `boi` | IATA | Boise (Boise Airport) |
| `cda` | Abbreviation | Coeur d'Alene — standard local abbreviation; no nearby IATA airport |
| `mt` | Postal | Montana — partial coverage in this scheme (Flathead Valley first; more metros later) |
| `fca` | IATA | Glacier Park International (Kalispell) — Flathead Valley; distinct from Missoula (`mso`, separate basin) |
| `wv` | Abbreviation | Willamette Valley |
| `s-or` | Abbreviation | Southern Oregon |
| `coast-or` | Abbreviation | Oregon Coast |
| `c-or` | Abbreviation | Central Oregon |
| `sle` | IATA | McNary Field (Salem) |
| `cvo` | IATA | Corvallis Municipal Airport |
| `eug` | IATA | Eugene (Mahlon Sweet Field) |
| `mfr` | IATA | Rogue Valley International-Medford Airport |
| `rbg` | IATA | Roseburg Regional Airport |
| `lmt` | IATA | Klamath Falls (Crater Lake-Klamath Regional) |
| `onp` | IATA | Newport Municipal Airport |
| `ast` | IATA | Astoria Regional Airport |
| `otk` | IATA | Tillamook Airport |
| `oth` | IATA | Southwest Oregon Regional (North Bend) |
| `bend` | Full name | Bend — short enough to use unabbreviated; no well-known IATA code |
| `pdt` | IATA | Eastern Oregon Regional Airport (Pendleton) |
| `bke` | IATA | Baker City Municipal Airport |
| `nca` | Abbreviation | Northern California |
| `ca` | Postal | California state |

IATA airport codes are used where they are well-known and unambiguous. Plain abbreviations are used where IATA codes are obscure or nonexistent. All names are lowercase per MeshCore firmware requirements.

---

## How Regions Work in MeshCore

Understanding the underlying mechanism helps explain why the naming convention matters and what it doesn't affect.

### Region names never appear in packets

When a message is sent with a region scope, the packet header carries **two 16-bit transport codes** — not the region name. These codes are computed as an HMAC-SHA256 of the region's TransportKey over the packet type byte and payload, truncated to 16 bits. A receiving repeater matches incoming transport codes by recomputing the HMAC for each of its configured regions until one matches.

| Packet field | Size | Present when |
|---|---|---|
| header | 1 byte | Always |
| transport_codes | 4 bytes | Only for `TRANSPORT_FLOOD` or `TRANSPORT_DIRECT` route types |
| path_len | 1 byte | Always |
| path | variable | Routing |
| payload | variable | Message content |

This means region names have **zero impact on packet size or airtime**. A region called `sea` produces the same 4-byte transport code overhead as one called `seattle-tacoma-bellevue-metropolitan-area`.

### Where region names do appear

Region names are transmitted only in response to an explicit **anonymous regions request** (`ANON_REQ` type `0x01`). This is a direct-routed, rate-limited exchange (max 4 anonymous requests per 180 seconds). The response carries a comma-separated list of region names that allow flooding, with a 172-byte budget.

Budget example for a typical repeater:

```
west,pnw,wa,w-wa,sea = 20 bytes including commas (152 bytes remaining)
```

A repeater with sub-region depth in Oregon:

```
west,pnw,or,wv,sle = 18 bytes (154 bytes remaining)
```

Even a heavily tagged border repeater stays well within budget:

```
west,pnw,or,pdx,wa,sw-wa = 24 bytes (148 bytes remaining)
```

### The naming convention is the coordination mechanism

`TransportKeys` are derived deterministically from region names. When two repeaters both configure a region called `sea`, they derive the same `TransportKey`; for each scoped packet, they compute the same transport code from that key and the packet payload, so forwarding matches without a separate key exchange. No separate key distribution or coordination is needed — agreement on region names is the entire protocol. This is why a published naming standard matters.

### The hierarchy is administrative, not functional

The parent/child relationships defined by `region put sea w-wa` are used only for display and organizational purposes in the firmware. They do **not** affect packet matching. When a flood packet arrives, the firmware iterates through every region the repeater carries and independently recomputes the transport code using that region’s `TransportKey` and the received packet’s payload. If any one matches, the packet is forwarded. The parent field is never consulted.

This means carrying `wa` does **not** automatically match traffic scoped to `w-wa` or `sea`. A repeater must explicitly carry every region it wants to forward — which is why the configuration examples list each ancestor with its own `region put`. On firmware **v1.15.0+**, each `region put` enables flooding for that region, so a separate `region allowf` after each put is unnecessary. On **v1.14.0** (and earlier 1.14.x), you still need `region allowf <name>` for each region after the corresponding `region put`; see [Repeater Configuration](#repeater-configuration). The hierarchy in this document describes the intended scoping relationships and helps operators understand which tags to configure; the firmware enforces scope through `TransportKey` matching (derived from each configured name), not through parent/child relationships.

---

## Scoping Behavior

| Scope on message | Forwarded by |
|---|---|
| *(none)* | Unscoped / legacy flood (firmware uses the reserved root region `*`, not a name wildcard) |
| `west` | All repeaters carrying `west` (entire mesh) |
| `pnw` | Pacific Northwest repeaters |
| `wa` | Washington State repeaters |
| `w-wa` | Western Washington repeaters |
| `sea` | Seattle metro repeaters |
| `e-wa` | Eastern Washington repeaters (Spokane and points north) |
| `se-wa` | Southeastern Washington repeaters (Walla Walla, Tri-Cities, Pullman) |
| `or` | Oregon repeaters |
| `pdx` | Portland metro repeaters (both OR and WA sides) |
| `wv` | Willamette Valley repeaters |
| `ie` | Inland Empire repeaters (both WA and ID sides) |
| `palouse` | Palouse repeaters (both the Pullman WA and Moscow ID sides) |
| `lc` | Lewiston / Clarkston repeaters (both the ID and WA sides, proposed) |
| `mt` | Montana repeaters using this scheme (partial — see `fca`) |
| `fca` | Flathead Valley repeaters |
| `id` | Idaho repeaters (not including `ie` unless they also carry `id`) |

In the firmware, `*` is always present as the root of the region tree (`RegionMap`: id 0, name `"*"`). It is not a pattern that matches every configured region name; it is the bucket for **unscoped** flood traffic (`ROUTE_TYPE_FLOOD`). Whether such packets are forwarded is controlled by flood policy on that root entry (`region allowf` / `region denyf` for `*`—by default, flood is allowed). Scoped traffic still requires a transport-code match to a region you actually carry.

A repeater only forwards scoped traffic if the transport code matches one of its configured regions. The parent/child hierarchy means a repeater configured with `west`, `pnw`, `wa`, `w-wa`, `sea` will forward traffic scoped to any of those five tags as long as flood is allowed (`allowf`) for that region.

---

## Repeater Configuration

> [!TIP]
> Don't want to assemble the commands by hand? The [Config Generator](config/) builds a ready-to-paste chain of `region` commands your location — pick your area and copy the result straight to your repeater. The examples below show what it produces and explain the reasoning, so you can also verify or adjust the output.

> [!WARNING]
> On **firmware 1.14.0** (and earlier **1.14.x**), after each `region put` you must run **`region allowf <regionname>`** for every region that should appear in the flood list—match the names from your `put` chain (the same `region put` names used in the examples below).  
> On **firmware 1.15.0+**, **`region put` turns on flood for that region by default**, so the examples below do not include separate `region allowf` lines.

### Example: Seattle, WA and Seattle Metro area

Use this repeater configuration in the Seattle metro area. The Seattle Metro area consists of three core counties: King, Snohomish, and Pierce. The same basic set of regions should be applied to repeaters in Tacoma, South Center, Bellevue, Lynnwood, or Everett.

```
region put west
region put pnw west
region put wa pnw
region put w-wa wa
region put sea w-wa
region save
```

Tags carried: `west`, `pnw`, `wa`, `w-wa`, `sea` (20 bytes in regions response)

### Example: Victoria / South Vancouver Island, BC

```
region put west
region put pnw west
region put bc pnw
region put vanisle bc
region put southisland vanisle
region save
```

Tags carried: `west`, `pnw`, `bc`, `vanisle`, `southisland` (33 bytes)

A repeater serving Metro Vancouver (Lower Mainland) instead:

```
region put west
region put pnw west
region put bc pnw
region put swbc bc
region save
```

Tags carried: `west`, `pnw`, `bc`, `swbc` (18 bytes)

### Example: Portland metro (OR side)

```
region put west
region put pnw west
region put or pnw
region put pdx or
region save
```

Tags carried: `west`, `pnw`, `or`, `pdx` (15 bytes)

Portland sits within the Willamette Valley geographically. A Portland repeater that also wants to participate in Willamette Valley traffic can add `wv`:

```
region put wv or
region save
```

Tags become: `west`, `pnw`, `or`, `pdx`, `wv` (18 bytes)

### Example: Spokane, WA

Spokane sits under `e-wa` (Eastern Washington — now the Spokane-and-points-north branch of the hierarchy), and also carries the cross-border `ie` tag for Inland Empire community traffic.

```
region put west
region put pnw west
region put wa pnw
region put e-wa wa
region put geg e-wa
region put ie pnw
region save
```

Tags carried: `west`, `pnw`, `wa`, `e-wa`, `geg`, `ie` (23 bytes)

### Example: Pullman, WA (the Palouse)

Pullman sits under `se-wa` (Southeastern Washington) alongside Walla Walla and the Tri-Cities. For everyday repeaters, it dual-carries `ie` (Inland Empire) and `palouse` — a sub-region of `ie` shared with Moscow, ID — plus `e-wa` as a tie back to the rest of Eastern Washington. Pullman does **not** carry `alw`, `psc`, or `geg` on everyday repeaters; those good-neighbor tags are reserved for high-site repeaters near those borders (see [Backbone and High-Site Repeaters](#backbone-and-high-site-repeaters)).

```
region put west
region put pnw west
region put wa pnw
region put se-wa wa
region put puw se-wa
region put e-wa wa
region put ie pnw
region put palouse ie
region save
```

Tags carried: `west`, `pnw`, `wa`, `se-wa`, `puw`, `e-wa`, `ie`, `palouse` (37 bytes)

### Example: Moscow, ID (the Palouse, Idaho side)

Moscow, Lewiston, and the Clearwater area carry `id` directly — there is no dedicated metro tag for this stretch of the Idaho panhandle (`cda` is reserved for Coeur d'Alene specifically). Moscow mirrors Pullman across the state line, dual-carrying `ie` and the shared `palouse` tag.

```
region put west
region put pnw west
region put id pnw
region put ie pnw
region put palouse ie
region save
```

Tags carried: `west`, `pnw`, `id`, `ie`, `palouse` (22 bytes)

### Example: Walla Walla / Tri-Cities, WA (Southeastern Washington)

Walla Walla (`alw`) and the Tri-Cities (`psc`) sit under `se-wa` (Southeastern Washington), the community-established identifier documented in the [ShrubSteppe SE-WA region proposal](https://wiki.shrubsteppe.net/Proposed%20Region%20Codes).

```
region put west
region put pnw west
region put wa pnw
region put se-wa wa
region put alw se-wa
region save
```

Tags carried: `west`, `pnw`, `wa`, `se-wa`, `alw` (18 bytes). The Tri-Cities configuration is identical with `psc` in place of `alw`.

### Example: Coeur d'Alene, ID

The Idaho-side mirror of Spokane. Carries `id` for Idaho-scoped traffic and `ie` for Inland Empire community traffic.

```
region put west
region put pnw west
region put id pnw
region put cda id
region put ie pnw
region save
```

Tags carried: `west`, `pnw`, `id`, `cda`, `ie` (21 bytes)

### Example: Boise, ID

Boise is straightforward — deep in Idaho, no cross-border community to straddle.

```
region put west
region put pnw west
region put id pnw
region put boi id
region save
```

Tags carried: `west`, `pnw`, `id`, `boi` (17 bytes)

### Example: Flathead Valley, MT (Kalispell / Glacier)

Northwest Montana's Flathead Valley is treated as its own local region under `mt`, not statewide coverage. Like Spokane and Coeur d'Alene, operators who want Inland Empire community scope add `ie` as a sibling under `pnw` (geologic and RF ties to the broader inland corridor).

```
region put west
region put pnw west
region put mt pnw
region put fca mt
region put ie pnw
region save
```

Tags carried: `west`, `pnw`, `mt`, `fca`, `ie` (18 bytes in regions response). Omit `region put ie pnw` if you only want Montana-scoped ancestry without IE-wide chat.

### Example: Backbone / high-site relay

See the dedicated [Backbone and High-Site Repeaters](#backbone-and-high-site-repeaters) section below for detailed guidance on tagging strategy for long-range linkers.

### Example: Border repeater near Portland (Clark County, WA)

A repeater that serves the Portland metro from the Washington side. It carries `pdx` (under `or`) for Portland metro traffic, plus `wa` and `sw-wa` for Washington-scoped traffic. This dual-carry pattern mirrors how Spokane carries both `wa` and `ie`.

```
region put west
region put pnw west
region put or pnw
region put pdx or
region put wa pnw
region put sw-wa wa
region save
```

Tags carried: `west`, `pnw`, `or`, `pdx`, `wa`, `sw-wa` (24 bytes)

### Example: Salem, OR (Willamette Valley)

A repeater serving Salem, in the Willamette Valley sub-region of Oregon.

```
region put west
region put pnw west
region put or pnw
region put wv or
region put sle wv
region save
```

Tags carried: `west`, `pnw`, `or`, `wv`, `sle` (18 bytes in regions response)

### Example: Medford, OR (Southern Oregon)

```
region put west
region put pnw west
region put or pnw
region put s-or or
region put mfr s-or
region save
```

Tags carried: `west`, `pnw`, `or`, `s-or`, `mfr` (20 bytes)

### Example: Yakima, WA (Central Washington)

```
region put west
region put pnw west
region put wa pnw
region put c-wa wa
region put ykm c-wa
region save
```

Tags carried: `west`, `pnw`, `wa`, `c-wa`, `ykm` (20 bytes)

---

## Cross-Border Metro Regions

### Portland

Portland lives under `or` in the hierarchy, reflecting that the Portland metro's center of gravity is in Oregon. Clark County WA repeaters use a dual-carry pattern: they carry `pdx` (under `or`) for Portland metro traffic, and also carry `wa` and `sw-wa` for Washington-scoped traffic. This mirrors how Spokane carries both `wa`/`e-wa` and `ie`.

Repeaters on the Oregon side carry `or`, `pdx`. Repeaters on the Washington side (Clark County) carry `or`, `pdx`, `wa`, and `sw-wa`. A `pdx`-scoped message reaches both sides. An `or`-scoped message reaches Portland (because Portland repeaters explicitly carry `or` in their configuration). An `or`-scoped message reaches any repeater that carries `or` (Portland configs include `or` in the ancestry chain). It does not match repeaters that carry only `pdx` without `or`. A `wa`-scoped message reaches the Clark County side but not the Oregon side.

### Inland Empire

The Inland Empire follows the same pattern as Portland — a cross-border community (`ie`) sitting as a direct child of `pnw`, not nested under either `wa` or `id`. The Spokane-Coeur d'Alene corridor functions as a single metro area that happens to straddle a state line.

Spokane repeaters carry `ie`, `wa`, and `e-wa`. Coeur d'Alene repeaters carry `ie` and `id`. An `ie`-scoped message reaches both sides. A `wa`-scoped message reaches Spokane but not CdA. An `id`-scoped message reaches CdA but not Spokane. The state boundary and the community boundary are both respected without conflict.

Pullman also dual-carries `ie` given its proximity to the Idaho border, even though it is no longer nested under `e-wa`/`geg` the way Spokane is — see [Palouse](#palouse) below.

### Southeastern Washington

Community convention in southeastern Washington has diverged from the flat `e-wa` grouping: `e-wa` now identifies with Spokane and points north, while Walla Walla and the Tri-Cities have adopted `se-wa` (Southeastern Washington) as their own regional identifier — a sibling of `e-wa` directly under `wa`, not nested beneath it. Walla Walla (`alw`) and the Tri-Cities (`psc`) carry `west`/`pnw`/`wa`/`se-wa` plus their own metro tag. Aligns with the [ShrubSteppe SE-WA region proposal](https://wiki.shrubsteppe.net/Proposed%20Region%20Codes) (revised 7/5/2026 to introduce `se-wa`).

Pullman also sits under `se-wa` alongside Walla Walla and the Tri-Cities — see [Palouse](#palouse) below for its cross-border tagging.

### Palouse

The Palouse straddles the WA/ID line the same way the Inland Empire straddles WA/ID further north: `palouse` is a sub-region of `ie`, not a direct child of `pnw`. Pullman, WA sits under `se-wa`; Moscow, Lewiston, and the Clearwater area sit directly under `id` (no dedicated metro tag — `cda` stays reserved for Coeur d'Alene specifically). Both sides dual-carry `ie` and `palouse`, so an `ie`- or `palouse`-scoped message reaches across the state line while `wa`- and `id`-scoped traffic stay on their own side.

Everyday repeaters on both sides keep it light — they do **not** carry `alw`, `psc`, or `geg`. Those good-neighbor tags toward Walla Walla, the Tri-Cities, and Spokane are reserved for high-site repeaters near those borders (see [Backbone and High-Site Repeaters](#backbone-and-high-site-repeaters)); close-border high sites on either side of the Palouse should carry all three.

Pullman's service area is understood to extend beyond Whitman County to also cover Asotin and Garfield counties, which have no repeaters of their own — for now; see Lewiston / Clarkston below.

### Lewiston / Clarkston

`lc` is a second, **proposed** cross-border sub-region of `ie`, one valley south of the Palouse — Lewiston, ID (Nez Perce County) and Clarkston, WA (Asotin County) sit as a single twin-city community split by the Snake River, the same way Pullman and Moscow are split by the state line. Per the local mesh's own site, it isn't finalized yet.

```
region put west
region put pnw west
region put id pnw
region put ie pnw
region put lc ie
region save
```

Tags carried: `west`, `pnw`, `id`, `ie`, `lc` (17 bytes). Clarkston, WA carries the same `ie`/`lc` pair, with `wa` (and likely `se-wa`) ancestry in place of `id` — but as noted above, Asotin County has no repeaters of its own today, so this side is aspirational.

> [!NOTE]
> `lc` is not related to "Lower Columbia" (the Astoria–Longview corridor covered by `ast` and `kls` in this scheme) — an easy mix-up given both are PNW places commonly shortened to "LC."

### Flathead Valley (Montana)

The Flathead (`fca`) sits under `mt` like other metros under their states. For operators who want regional coherence with the Inland Empire mesh community (and Cascadia-fringe geology), the same dual-carry pattern applies: add `ie` as a direct child of `pnw`, alongside `mt`/`fca` ancestry — `region put ie pnw`. An `ie`-scoped message then reaches Flathead repeaters that carry `ie`, while `fca`-scoped traffic stays local to the valley unless repeaters deliberately carry broader tags.

---

## Backbone and High-Site Repeaters

High-site repeaters that link metro areas together are the most important nodes to tag correctly. A local neighborhood repeater is straightforward — it carries its full ancestry and serves one metro. But a mountaintop repeater whose RF footprint spans multiple metros or crosses the boundary between two regions requires deliberate choices about what traffic it should and shouldn't forward.

### The core principle

**RF reach is not scope boundary.** A repeater on Cougar Mountain may be physically heard by nodes in both Seattle and Vancouver, but it only forwards scoped traffic that matches its own region tags. A `sea`-scoped message forwarded by Cougar Mountain will be *heard* by Vancouver repeaters, but they won't re-forward it because they don't carry `sea`. The packet dies at the scope boundary — one hop past the last matching repeater.

That one extra hop is the cost of having a high-site repeater carry a local tag. It's generally acceptable: the packet is transmitted once into non-matching territory and stops. It does not cascade.

### Tagging strategies

There are three approaches for backbone repeaters, each with different tradeoffs:

**Strategy 1: State-level only (strictest filtering)**

The backbone repeater carries only its ancestry down to the state level and does not carry any metro tag.

```
region put west
region put pnw west
region put wa pnw
region save
```

Tags: `west`, `pnw`, `wa` (11 bytes)

This repeater forwards `west`, `pnw`, and `wa` scoped traffic. It **ignores** `sea`, `swbc`, `bli`, and all other metro-scoped messages. Local chatter stays local. Only state-wide or broader messages cross the backbone.

Best for: Dedicated long-haul links between distant metros (e.g. a Seattle-to-Portland chain over the I-5 corridor). These repeaters exist to carry wide-scope traffic and shouldn't be burdened with local flood from either end.

**Strategy 2: Single metro affiliation (common case)**

The backbone repeater carries one metro tag reflecting where it primarily serves, even though its signal reaches further.

```
region put west
region put pnw west
region put wa pnw
region put w-wa wa
region put sea w-wa
region save
```

Tags: `west`, `pnw`, `wa`, `w-wa`, `sea` (20 bytes)

This repeater forwards Seattle metro traffic. If it's heard in Bellingham or Skagit, those repeaters won't re-forward `sea` traffic — it stops at the first non-matching hop. Meanwhile `wa`-scoped traffic flows freely through the backbone.

Best for: High-site repeaters that primarily serve one metro but happen to have long range. A repeater on Cougar Mountain that's part of the Seattle mesh but can be heard from Whidbey Island would use this approach. The Whidbey repeaters don't carry `sea`, so Seattle-local traffic doesn't propagate north.

**Strategy 3: Dual metro affiliation (use sparingly)**

The backbone repeater carries tags for two metros because it genuinely serves as the bridge between them.

```
region put west
region put pnw west
region put wa pnw
region put w-wa wa
region put sea w-wa
region put bli w-wa
region save
```

Tags: `west`, `pnw`, `wa`, `w-wa`, `sea`, `bli` (24 bytes)

This repeater forwards local traffic for **both** Seattle and Bellingham. A `sea`-scoped message will be forwarded into Bellingham's RF space (and vice versa), though Bellingham repeaters still won't re-forward `sea` traffic.

Best for: Rare cases where a single high-site genuinely bridges two adjacent metros and the operator wants both communities' local traffic to cross. **Use this sparingly** — if too many backbone repeaters carry dual metro tags, the benefit of metro-level scoping erodes. The whole point of local scoping is that local traffic stays local.

### Decision guide for backbone operators

| Question | If yes → | If no → |
|---|---|---|
| Does this repeater primarily serve one metro area? | Use Strategy 2 with that metro's tag | Continue below |
| Is this repeater a dedicated long-haul link? | Use Strategy 1 (state-level only) | Continue below |
| Does this repeater intentionally bridge two adjacent metros? | Use Strategy 3 (dual affiliation) | Use Strategy 1 |

### Example: Seattle-to-Vancouver corridor

Consider a chain of repeaters linking Seattle to Vancouver BC through Bellingham:

```
Seattle neighborhood repeater           →  west, pnw, wa, w-wa, sea
Cougar Mountain (high-site)             →  west, pnw, wa, w-wa, sea     (Strategy 2)
Haystack Mountain (high-site)           →  west, pnw, wa, w-wa, sea     (Strategy 2)
Skagit Valley repeater                  →  west, pnw, wa, w-wa, bvs
Bellingham repeater                     →  west, pnw, wa, w-wa, bli
Sumas Mountain border-area high-site    →  west, pnw, wa               (Strategy 1)
Metro Vancouver repeater                →  west, pnw, bc, swbc
```

Traffic flow for a message scoped to `sea`:
- Seattle neighborhood repeater: **forwards** (carries `sea`)
- Cougar Mountain: **forwards** (carries `sea`)
- Skagit Valley: **heard but not forwarded** (no `sea` tag) → packet stops
- Bellingham and beyond: never see it

Traffic flow for a message scoped to `wa`:
- All WA repeaters in the chain: **forward**
- Sumas border high-site: **forwards** (carries `wa`)
- Metro Vancouver: **heard but not forwarded** (no `wa` tag) → packet stops

Traffic flow for a message scoped to `pnw`:
- Every repeater in the chain: **forwards** (all carry `pnw`)
- The message reaches from Seattle through to Vancouver

This is the intended behavior: local stays local, state-wide reaches the state, PNW-wide crosses the border.

### Example: Seattle-to-Spokane corridor

Consider a chain of repeaters linking the west side to the Inland Empire:

```
Seattle neighborhood repeater           →  west, pnw, wa, w-wa, sea
Snoqualmie Pass high-site               →  west, pnw, wa               (Strategy 1)
Ellensburg repeater                     →  west, pnw, wa, c-wa, eln
Spokane repeater                        →  west, pnw, wa, e-wa, geg, ie
Coeur d'Alene repeater                  →  west, pnw, id, cda, ie
```

Traffic flow for a message scoped to `ie`:
- Seattle and pass repeaters: **not forwarded** (no `ie` tag)
- Spokane: **forwards** (carries `ie`)
- Coeur d'Alene: **forwards** (carries `ie`)
- Inland Empire chat stays in the Inland Empire

Traffic flow for a message scoped to `wa`:
- All WA repeaters: **forward**
- Spokane: **forwards** (carries `wa`)
- Coeur d'Alene: **heard but not forwarded** (no `wa` tag) → packet stops

Traffic flow for a message scoped to `pnw`:
- Every repeater in the chain: **forwards** (all carry `pnw`)
- The message reaches from Seattle through to CdA

---

## Urban Infrastructure and Neighborhood Repeaters

Most repeaters in this mesh are not on mountaintops — they are indoor nodes, rooftop installs covering a neighborhood or a few city blocks. The [Backbone and High-Site Repeaters](#backbone-and-high-site-repeaters) section does not apply to them. For urban infrastructure and neighborhood nodes the configuration is simpler due to the network topology and geographic reach.

### Always carry your full ancestry

**Limited RF range is not a reason to strip tags.** A neighborhood repeater in Portland should carry the same ancestry chain as a Portland backbone node:

```
region put west
region put pnw west
region put or pnw
region put pdx or
region save
```

Tags carried: `west`, `pnw`, `or`, `pdx` (15 bytes)

A repeater's tags do not control how far its traffic travels — that is set by each message's scope and the layout of the mesh, not by your antenna (the same principle as [RF reach is not scope boundary](#the-core-principle), seen from the other side). Carrying `west` and `pnw` does not turn a small node into a region-wide transmitter; it only lets you relay the wide-scope messages that are already flooding the mesh, and those are rare by design. The airtime cost is minimal, and it keeps your corner of the mesh connected to region-wide conversations.

Stripping tags, by contrast, only causes harm. If you omit `or`, your node will not forward an `or`-scoped message — so any device that reaches the mesh only through you is cut off from `or` traffic in both directions, and you leave a hole in `or` coverage for the neighbors behind you. Your role is to be a complete on-ramp for the devices near you, not to gatekeep which scopes pass through.

### Choosing a channel scope

**Tag configuration and channel scope are independent choices.** Carry the full ancestry on your repeater; choose the scope on each channel to match how far you want that conversation to travel.

For everyday chat in a metro area, scope your Public channel to your local metro tag. A `pdx`-scoped message from a low-range node only has to reach one neighboring repeater that carries `pdx`; from there it propagates across the metro through every `pdx`-carrying repeater — including both the Oregon and Clark County WA sides. If you want to talk to people across Oregon, scope to `or`; if you want to reach the whole Pacific Northwest, scope to `pnw`. The point is to match the scope to the intended audience — not to default to the widest available scope for general local chat, which sends neighborhood conversation through repeaters in Salem, Eugene, Medford, and beyond that have no stake in it.

| Scope | Reaches | Use for |
|---|---|---|
| `pdx`, `sea`, `bli`, … | One metro area | General public chat, local coordination |
| `or`, `wa`, `bc`, … | One state or province | Statewide announcements, inter-city coordination |
| `pnw` | Pacific Northwest | Cross-regional emergencies, PNW-wide nets |
| `west` | Entire mesh | Mesh-wide announcements only |

Scope as narrowly as the conversation warrants. Metro scope for local chat is the right default.

### Border proximity

Being geographically close to a state or provincial line does not automatically make a repeater a border node. The deciding factor is RF overlap: **if your node can only hear repeaters on one side of the border, carry only that side's tags.**

If you are in Clark County WA and your node can hear Portland metro repeaters across the Columbia River, carrying `pdx` lets you relay Portland metro traffic on both sides — and that is a community choice as much as an RF one. Because regions are matched per-tag, not [hierarchically](#the-hierarchy-is-administrative-not-functional), the `pdx` metro tag does not require also carrying `or`: a Clark County node can join the Portland metro conversation without relaying statewide Oregon traffic. The [Clark County dual-carry configuration](#example-border-repeater-near-portland-clark-county-wa) is the fuller version that carries `or` and the Washington ancestry alongside `pdx`; omit `or` if you want the metro tie without the statewide one.

If your RF footprint stays entirely on your own side of the line, the standard single-state config is correct. Proximity to a line on a map is not, by itself, a reason to add a neighboring *state* tag — but a genuine community tie across it can justify carrying a neighboring *metro* tag like `pdx`.

The US/Canada border follows the same principle, but with one important difference: there is no cross-border community tag for the Bellingham–Vancouver corridor the way `pdx` bridges the Columbia or `ie` bridges Spokane and Coeur d'Alene. Border crossing there happens at the backbone level — high-site repeaters within RF range across the line relay `pnw`-scoped (or `west`-scoped) traffic between the two countries (see the [Seattle-to-Vancouver corridor example](#example-seattle-to-vancouver-corridor)). A Bellingham repeater carries `west`, `pnw`, `wa`, `w-wa`, `bli` — no `bc` tags. A Metro Vancouver repeater carries `west`, `pnw`, `bc`, `swbc` — no `wa` tags. So a `wa`- or `bc`-scoped message won't propagate beyond its own country — it stops at the first repeater across the line that doesn't carry the tag — while `pnw` reaches both. Neither side's urban nodes need to carry the other country's state or provincial tags.

---

## Future Extensions

### California

As the mesh extends south, California gets its own state tag under `west`, with sub-regions nested beneath it:

```
west
    pnw
        (existing regions)
    ca
        nca                 Northern California
        bay                 Bay Area
        sca                 Southern California
```

No changes to any existing PNW repeater configuration are needed. California repeaters carry `west` and `ca` as their upper-level tags, and `west`-scoped traffic reaches the whole mesh.

### Additional PNW areas

New local areas can be added without restructuring:

| Tag | Area | Parent | Source |
|---|---|---|---|
| `frd` | San Juan Islands / Friday Harbor | `w-wa` | IATA |
| `nuw` | Whidbey / Camano (Island County) | `w-wa` | IATA (NAS Whidbey / Ault Field) |
| `mso` | Missoula (western Montana, Bitterroot drainage) | `mt` | IATA — distinct basin from Flathead (`fca`) |
| `gorge` | Columbia Gorge (Hood River OR + White Salmon WA) | `pnw` | Abbreviation — cross-border tag like `ie` and `pdx` |
| `ycd` | Nanaimo / central Vancouver Island | `vanisle` | IATA |
| `ylw` | Kelowna / Okanagan | `bc` | IATA |

---

## Bot Behavior with Regions

Bots (weather, APRS, utilities, etc.) generate flood traffic and should be scoped carefully to avoid polluting the wider mesh.

### Channel scoping

Bot traffic should be sent on dedicated hashtag channels scoped to the bot's service area — for example `#bot-sea`, `#bot-oly`. This keeps bot output separate from general conversation and allows repeater operators to selectively allow or deny bot channels without affecting other traffic.

### Region scoping

In addition to channel scoping, bots should be configured with a default region scope that matches their service area. This ensures bot floods are constrained by the same region boundaries as other traffic.

For the [meshcore-bot](https://github.com/meshcore/meshcore-bot) project, set the `flood_scope` in your configuration to your local region:

```
flood_scope = #sea
```

Users of meshcore-bot v0.9.0 and later should set the list of flood scopes they wish to respond to and match in their responses:

```
flood_scopes = #sea, #w-wa
```

This means the bot will respond to messages scoped to either `#sea` or `#w-wa`, and its responses will be scoped accordingly. A bot serving the Willamette Valley might use:

```
flood_scopes = #sle, #wv
```

### Guidelines for bot operators

- **Match your service area**: A weather bot for Seattle should scope to `#sea`, not `#wa` or `#pnw`. Scope as narrowly as practical.
- **Use hashtag channels**: Sending bot output on `#bot-sea` rather than the general channel lets users and repeater operators filter bot traffic independently of human conversation.
- **Avoid unscoped floods**: A bot that floods without a region scope reaches the entire mesh. This is almost never appropriate.

---

## Adoption Notes

- **Backward compatible**: Unscoped messages flood everywhere via `*`. Regions are opt-in for traffic reduction.
- **Minimum config**: Every repeater should carry its full ancestry. Because region matching is independent per name (see [The hierarchy is administrative, not functional](#the-hierarchy-is-administrative-not-functional)), skipping a level means that scope won't be forwarded. A Seattle repeater carries `west`, `pnw`, `wa`, `w-wa`, `sea` (5 tags). A Salem repeater carries `west`, `pnw`, `or`, `wv`, `sle` (5 tags). Cross-border community tags like `ie` are additional — they sit alongside the state ancestry, not in place of it.
- **Firmware requirement**: MeshCore 1.10.0 or newer. Older firmware ignores transport codes entirely.
- **Companion app**: The Companion app supports region scoping for client traffic in two ways: a per-channel scope (**Set Region Scope** on the channel) and an app-wide default applied to all flood packets it sends (**Settings → Experimental Settings → Default Region Scope**). It also includes a **Tools → Discover Regions** scan to see which region tags are live nearby. CLI and meshcore-cli expose the full scoping and repeater-configuration commands. Note that region *tags* (`region put`) are still configured only on repeaters, not clients.
- **Community agreement**: Local area codes (the fourth level) should be agreed upon by the local mesh community. This document provides a starting point; the names should be ratified through Puget Mesh, Cascadia Mesh, PDX Mesh, Salish Mesh, and other local groups.

---

## Quick Reference

| Tag | Scope | Parent |
|---|---|---|
| `west` | Entire mesh | *(root)* |
| `pnw` | Pacific Northwest | `west` |
| `wa` | Washington State | `pnw` |
| `w-wa` | Western Washington | `wa` |
| `sea` | Seattle / Tacoma / Bellevue metro | `w-wa` |
| `oly` | Olympia / South Sound | `w-wa` |
| `kit` | Kitsap / Bremerton | `w-wa` |
| `grh` | Grays Harbor / WA coast | `w-wa` |
| `bvs` | Skagit Valley | `w-wa` |
| `bli` | Bellingham / Whatcom | `w-wa` |
| `sw-wa` | Southwest Washington | `wa` |
| `cls` | Centralia / Chehalis | `sw-wa` |
| `kls` | Kelso / Longview | `sw-wa` |
| `c-wa` | Central Washington | `wa` |
| `ykm` | Yakima | `c-wa` |
| `eat` | Wenatchee | `c-wa` |
| `eln` | Ellensburg | `c-wa` |
| `mwh` | Moses Lake | `c-wa` |
| `e-wa` | Eastern Washington (Spokane and points north) | `wa` |
| `geg` | Spokane metro | `e-wa` |
| `se-wa` | Southeastern Washington | `wa` |
| `alw` | Walla Walla | `se-wa` |
| `puw` | Pullman (dual-carries `e-wa`, `ie`, `palouse`; high-site adds `alw`/`psc`/`geg`) | `se-wa` |
| `psc` | Tri-Cities (Pasco / Kennewick / Richland) | `se-wa` |
| `ie` | Inland Empire (cross-border) | `pnw` |
| `palouse` | Palouse (cross-border, Pullman WA ↔ Moscow ID) | `ie` |
| `lc` | Lewiston / Clarkston (cross-border, proposed) | `ie` |
| `mt` | Montana (partial) | `pnw` |
| `fca` | Flathead Valley / Kalispell / Glacier | `mt` |
| `or` | Oregon | `pnw` |
| `pdx` | Portland metro (cross-border) | `or` |
| `wv` | Willamette Valley | `or` |
| `sle` | Salem / Keizer | `wv` |
| `cvo` | Corvallis / Albany | `wv` |
| `eug` | Eugene / Springfield | `wv` |
| `s-or` | Southern Oregon | `or` |
| `mfr` | Medford / Ashland | `s-or` |
| `rbg` | Roseburg | `s-or` |
| `lmt` | Klamath Falls | `s-or` |
| `coast-or` | Oregon Coast | `or` |
| `onp` | Newport / Lincoln City | `coast-or` |
| `ast` | Astoria / Seaside | `coast-or` |
| `otk` | Tillamook | `coast-or` |
| `oth` | North Bend / Coos Bay | `coast-or` |
| `c-or` | Central Oregon | `or` |
| `bend` | Bend / Redmond | `c-or` |
| `pdt` | Pendleton | `c-or` |
| `bke` | Baker City | `c-or` |
| `id` | Idaho (Moscow / Lewiston / Clearwater carry this directly, dual-carries `ie`/`palouse`) | `pnw` |
| `boi` | Boise metro | `id` |
| `cda` | Coeur d'Alene / N. Idaho | `id` |
| `bc` | Southern British Columbia | `pnw` |
| `swbc` | Southwest BC / Lower Mainland | `bc` |
| `vanisle` | Vancouver Island | `bc` |
| `southisland` | South Vancouver Island / Victoria | `vanisle` |
| `salishmesh` | Salish Sea / Gulf Islands | `bc` |
| `ca` | California (future) | `west` |
| `nca` | Northern California (future) | `ca` |
| `bay` | Bay Area (future) | `ca` |
| `sca` | Southern California (future) | `ca` |

---

## Changelog

### 2026-07-09

- **Palouse cross-border tag (`palouse`)**: Added `palouse`, a cross-border sub-region of `ie` (parent `ie`, not `pnw`), shared by Pullman, WA and the Moscow/Lewiston/Clearwater area — direct feedback from the local mesh, cross-checked against [palouse-mesh.net/regions](https://palouse-mesh.net/regions/). Pullman's everyday config now dual-carries `ie`, `palouse`, and `e-wa`; it no longer dual-carries `alw`, `psc`, `id`, or `cda`.
- **Moscow / Lewiston / Clearwater carry `id` directly**: No dedicated metro tag for this stretch of the Idaho panhandle — `cda` stays reserved for Coeur d'Alene specifically, matching the local mesh's own site (which also notes the prior `id → n-id → puw` nesting is no longer used). Added an `id`-tagged seed so the config/map tools can resolve this area, and rewrote the Moscow example accordingly.
- **Good-neighbor tags moved to high-site only**: `alw`, `psc`, and `geg` are no longer part of Pullman's (or Moscow's) everyday config — they're reserved for high-site repeaters near those borders, per the local mesh's clarification. Updated the Palouse section and Quick Reference accordingly.
- **Lewiston / Clarkston (`lc`, proposed)**: Added `lc`, a second cross-border sub-region of `ie` (sibling of `palouse`) for the Lewiston, ID / Clarkston, WA twin-city valley, per [palouse-mesh.net/regions](https://palouse-mesh.net/regions/). Not yet wired into the config/map tool's automatic resolver — added as a manual-only example for now, since Lewiston shares the same `id` catch-all pocket as Moscow and there's no modeled ID/WA border precise enough to auto-distinguish the two.

### 2026-07-07

- **Southeastern Washington (`se-wa`)**: Added `se-wa` under `wa`, a sibling of `e-wa`, reflecting community convention that has developed since the last update — `e-wa` now identifies with Spokane and points north, while Walla Walla and the Tri-Cities have adopted `se-wa` as their regional identifier. Reparented `alw` (Walla Walla) and `psc` (Tri-Cities) from `e-wa` to `se-wa`. Updated the hierarchy tree, Name Rationale table, Scoping Behavior table, and Quick Reference accordingly. Aligns with the revised [ShrubSteppe SE-WA region proposal](https://wiki.shrubsteppe.net/Proposed%20Region%20Codes) (revised 7/5/2026 to introduce `se-wa`).
- **Pullman (`puw`) moves to `se-wa`**: Pullman is now primarily `se-wa` (alongside Walla Walla and the Tri-Cities), reparented from `e-wa`, and explicitly dual-carries `alw` and `psc` as a good-neighbor policy toward those two communities, plus `e-wa` as a tie back to the rest of Eastern Washington. Pullman also proactively dual-carries `ie`, `id`, and `cda` given its proximity to the Idaho border and the Coeur d'Alene community. Pullman does not carry `geg` — that Spokane-specific affinity has shifted away. Added a dedicated Pullman repeater example and a Walla Walla / Tri-Cities (`se-wa`) example.
- **Pullman coverage**: Documented Pullman's service area as extending beyond Whitman County to also cover Asotin and Garfield counties, which have no repeaters of their own.

### 2026-06-27

- **Tri-Cities (`psc`)**: Added Tri-Cities (Pasco / Kennewick / Richland, IATA `PSC` — Tri-Cities Airport at Pasco) under `e-wa`, promoted from Future Extensions into the main hierarchy. Updated the hierarchy tree, Name Rationale table, and Quick Reference accordingly.
- **Pullman / Inland Empire (`ie`)**: Pullman (`puw`, the Palouse) now dual-carries `ie` alongside its `e-wa` ancestry, matching the Spokane / Coeur d'Alene pattern — `region def west pnw wa e-wa puw|pnw ie`. Walla Walla (`alw`) and the Tri-Cities (`psc`) stay `e-wa`-only and do not carry `ie`. Aligns with the [ShrubSteppe SE-Washington region proposal](https://wiki.shrubsteppe.net/Proposed%20Region%20Codes).
- **Firmware default**: The Config Generator and map selector now default to firmware **v1.16.0+** (single-line `region def`), reflecting the 1.16.0 release. The 1.15 and 1.14 modes remain available via the toggle.

### 2026-06-01

- **Tillamook (`otk`)**: Added a dedicated north-central Oregon Coast region (IATA `OTK`, Tillamook Airport) under `coast-or`, filling the gap between `ast` (Astoria / Seaside) and `onp` (Newport / Lincoln City).

### 2026-05-28

- **Urban infrastructure and neighborhood repeaters**: Added a section covering ordinary low-range nodes (rooftop, indoor, portable) — guidance to carry full ancestry regardless of RF range, how to choose a channel scope, and how to handle proximity to the OR/WA and US/Canada borders.
- **Client-only orientation**: Added a note after the Overview directing users with a phone or client device (no repeater) to the parts that apply to them — per-channel **Set Region Scope** and the **Default Region Scope** in Experimental Settings — and pointing the rest of the document at repeater operators.
- **Companion app adoption note**: Replaced the outdated "scope selection is limited" note with an accurate description of current app capabilities (per-channel scope, app-wide default scope, Discover Regions), clarifying that region tags remain repeater-only.
- **Config Generator link**: Added a pointer to the Config Generator at the top of Repeater Configuration for operators who would rather generate their `region put` chain than assemble it by hand.

### 2026-05-21

- **BC region overhaul**: Replaced the IATA-approximation tags (`yvr`, `fra`, `vic`) with the community-established region tags that BC mesh operators are actively using: `swbc` (Southwest BC / Lower Mainland), `vanisle` (Vancouver Island), `southisland` (South Vancouver Island / Victoria, nested under `vanisle`), and `salishmesh` (Salish Sea / Gulf Islands). Updated hierarchy tree, Name Rationale table, Quick Reference table, Victoria repeater example, and all inline references accordingly. Updated Design Principles to reflect that BC uses community-established names rather than IATA codes. Moved `ycd` (Nanaimo / central Vancouver Island) parent from `bc` to `vanisle` in Future Extensions.

### 2026-05-16

- **Clarify TransportKeys and Codes** to improve clarity on how `TransportKeys` are distinct from transport codes.
- **Changed Lake Stevens example** to add clarification that the same region set should work for Seattle and the Seattle Metro Area.

### 2026-05-10

- **Montana / Flathead Valley**: Added `mt` (Montana, partial coverage) and `fca` (Flathead Valley / Kalispell / Glacier, Glacier Park International) under `pnw` → `mt` → `fca`. Documented dual-carry with `ie` for Inland Empire community scope, matching the Spokane / Coeur d'Alene pattern. Reserved `mso` (Missoula) in Future Extensions as a distinct basin from Flathead. Added a Flathead Valley repeater configuration example.

### 2026-05-09

- **Scoping** (`*`): Clarified that firmware `*` is the reserved root region (unscoped / legacy flood), not a name wildcard meaning “all regions”; updated the scoping table and added a short explanation of flood policy on `*`.
- **Oregon Coast**: Renamed region code from `or-coast` to `coast-or` for consistency with sibling sub-regions (`s-or`, `c-or`)
- **Repeater CLI examples**: Documented MeshCore **v1.15.0+** behavior (`region put` enables flooding per region); removed redundant `region allowf` lines from examples; added a compatibility note for **v1.14.0** / earlier **1.14.x** (`region allowf` still required after each `put`); updated the Overview and “hierarchy is administrative” sections accordingly.

### 2026-04-08

- **WA sub-regions**: Added intermediate grouping level — Western Washington (`w-wa`), Southwest Washington (`sw-wa`), Central Washington (`c-wa`), Eastern Washington (`e-wa`). All existing WA cities now nest under their respective sub-regions.
- **Skagit Valley**: Changed region code from `ska` to `bvs` (IATA code for Skagit Regional Airport; `ska` is actually Fairchild AFB in Spokane)
- **New WA cities**: Added Grays Harbor (`grh`), Centralia/Chehalis (`cls`), Kelso/Longview (`kls`), Yakima (`ykm`), Wenatchee (`eat`), Ellensburg (`eln`), Moses Lake (`mwh`), Walla Walla (`alw`), Pullman (`puw`)
- **Oregon sub-regions**: Added intermediate grouping level — Willamette Valley (`wv`), Southern Oregon (`s-or`), Oregon Coast (`or-coast`), Central Oregon (`c-or`)
- **Salem**: Changed region code from `sal` to `sle` (IATA code for McNary Field)
- **Corvallis**: Changed region code from `cor` to `cvo` (IATA code for Corvallis Municipal Airport)
- **New OR cities**: Added Medford (`mfr`), Roseburg (`rbg`), Klamath Falls (`lmt`), Newport (`onp`), Astoria (`ast`), North Bend/Coos Bay (`oth`), Bend (`bend`), Pendleton (`pdt`), Baker City (`bke`)
- **PDX placement**: Moved Portland (`pdx`) from `pnw`-level to under `or`. Clark County WA repeaters dual-carry `pdx` + `wa` + `sw-wa`, mirroring the Spokane/IE cross-border pattern.
- **Bend**: Moved from Future Extensions into main hierarchy under `c-or`
- **Grays Harbor**: Moved from Future Extensions into main hierarchy under `w-wa`
- **Spokane**: Changed region code from `spo` to `geg` (IATA code for Spokane International Airport / Geiger Field)
- **Coeur d'Alene**: Changed region code from `cde` to `cda` (standard local abbreviation)
- **Lewis County**: Removed from Future Extensions (now covered by `cls` under `sw-wa`)