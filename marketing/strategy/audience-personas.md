# Audience personas

Two acquisition audiences, run as separate content streams with separate
captions, separate landing pages and separate UTM campaign strings. They are
not translations of each other.

Live market size, from `GET /api/v1/public/stats` (read at the time of
writing - always re-read before publishing a number):

| Listing type | Count |
| --- | --- |
| Vendors | 2,710 |
| Planners | 431 |
| Claimed vendors | 0 |
| Claimed planners | 0 |
| Registered couples | 0 |

That last row is the point of this whole programme: the directory has
inventory and no audience yet, and no vendor has claimed a profile yet. Both
are acquisition problems, and both are solved by the same content engine.

---

## A. Greek couples (`audience: el`)

**Who.** A couple in Greece, or one of the two in a Greek family, planning a
wedding in the next 6-18 months. They already know the country, they know the
customs, and they are not looking for a travel guide - they are looking for
reliable people and they want to know what is normal here.

**What they need from us.**

- Confidence that a vendor is real and current. The local word for this is
  *τρέξε τα πράγματα* - do the rounds.
- Local knowledge that is not in any blog: what a μίσα μίσα works out to,
  what the μάσαξα really is, when the κέρνος arrives, what the church
  requires.
- A shortlist, not a catalogue.

**What they do not want.** Translations of English wedding content. Generic
"top 10" listicles. Any suggestion that they need a wedding planner to have
a wedding.

**Where they are.** Instagram is the primary surface - the mobile feed, the
save-and-return behaviour, and the fact that Greek Instagram usage for local
services is heavily review-driven. Facebook matters more here than for the
English stream: it is where the older half of the audience is, and where
couple recommendations travel.

**The content that works.** Specific local questions answered properly.
"Τι να ρωτήσετε στον φωτογράφο" beats "Η τέλεια μέρα". Cost and logistics
breakdowns. Real categories of vendor with real counts.

**Language.** Greek, in the Greek alphabet, with real Greek terms of art. The
validation gate rejects a Greek caption that is not actually Greek.

**UTM.** `utm_campaign` begins `ww_greek_...`.

---

## B. International destination couples (`audience: en`)

**Who.** A couple from abroad planning a wedding in Greece - Santorini,
Mykonos, Corfu, Lefkada, Thessaloniki, and the mainland. They are spending
a significant sum in a currency that is not theirs, in a country whose
administrative and cultural processes they do not know.

**What they need from us.**

- Logistics they cannot get from a travel blog: how far in advance to book,
  what the noise and access rules are, whether the ceremony can be at a
  municipal venue, how the paperwork works.
- Confidence in the vendors, because they cannot visit all of them.
- Price clarity in euro, when a real price exists in the data.

**What they do not want.** "Paradise wedding" fantasy content, or
destination-wedding packages sold as a bundle. They are individuals
assembling their own day.

**Where they are.** Instagram Reels dominate - a destination couple planning
from abroad consumes video, saves lists, and shares them with a partner who
is in another timezone. Facebook matters less here but is not zero, and it is
cheap to run the same content there.

**The content that works.** "Here is what actually happens when you plan a
Santorini wedding in June" - logistics, sequence, what goes wrong and how to
avoid it. Vendor lists by island and category. Local vendor photography is
exactly what they want and exactly what we may not republish, which is why
brand-native graphics and our own product screenshots carry this stream.

**Language.** English. Greek place names stay in their common English form
(Santorini, Mykonos, Corfu); Greek terms are explained rather than
translated.

**UTM.** `utm_campaign` begins `ww_destination_...`.

---

## C. Vendors (`pillar: discovery` audience - the secondary audience)

Not a social audience yet, but the reason the discovery pillar exists and the
audience the P2 claim campaign will target.

A vendor in the directory today has an unclaimed profile. That means: no
control over their listing, no enquiries routed, no way to correct a stale
detail, and no way to know the directory exists at all.

The social channel for vendors is not Instagram - it is a direct, one-to-one
email or a phone call, and it happens only with consent. The social content
that supports it is the *visibility* argument: "there are 214 photographers
in Athens; a couple searching for a photographer in Athens is looking at the
same page you are listed on."

Rules that apply to all vendor contact:

- No unsolicited automated DMs, on any platform, ever.
- No automated bulk email. A claim campaign is a curated, human-reviewed
  list with a human-written message.
- We never imply that a vendor has endorsed us until they have claimed.
