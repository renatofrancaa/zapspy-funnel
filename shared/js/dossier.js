/* deploy-trigger: 2026-06-11T18:25 — force Railway rebuild from latest HEAD */
/*
 * DOSSIER_V1 — Coherent, deterministic "case profile" for the funnel.
 *
 * Goal: every fabricated stat (deleted msgs, hidden media, secret contacts,
 * late-night chats, suspicion score, locations, frequent contact...) must be
 * (a) the SAME on every screen (phone scan, conversations, checkout) and
 * (b) the SAME every time for a given target number — so a skeptical user
 * never sees the numbers "change" between pages, which instantly reads as fake.
 *
 * It is seeded purely by the target phone number, so the same number always
 * yields the same dossier. Real data (profile name/picture, lead geo city) is
 * woven in by the pages that have it.
 *
 * The dossier also writes the legacy localStorage keys the existing pages
 * already read (deletedMsgs, deletedMedia, hiddenContacts, lateNightCount),
 * so wiring it in does not require rewriting the display code.
 */
(function () {
    'use strict';

    // cyrb53 string hash -> 32-bit seed
    function cyrb53(str, seed) {
        seed = seed || 0;
        var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (var i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    }

    // mulberry32 seeded PRNG -> deterministic stream in [0,1)
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    var STORAGE_KEY = 'zapDossier';

    function rint(rng, min, max) {
        return Math.floor(rng() * (max - min + 1)) + min;
    }

    function build(cleanPhone, gender) {
        var rng = mulberry32(cyrb53(cleanPhone || 'anon'));
        // Burn a couple of values so close numbers diverge quickly
        rng(); rng();

        var deletedMsgs = rint(rng, 184, 423);
        var deletedMedia = rint(rng, 58, 187);
        var hiddenContacts = rint(rng, 6, 17);
        var lateNightChats = rint(rng, 23, 59);
        var locations = rint(rng, 2, 8);
        var frequentMessages = rint(rng, 187, 521);
        var nightPct = rint(rng, 63, 93);
        var suspicion = Math.min(
            97,
            70 + Math.floor(deletedMsgs / 40) + Math.floor(lateNightChats / 8)
        );

        return {
            v: 1,
            phone: cleanPhone || 'anon',
            gender: gender || '',
            deletedMsgs: deletedMsgs,
            deletedMedia: deletedMedia,
            hiddenContacts: hiddenContacts,
            lateNightChats: lateNightChats,
            locations: locations,
            frequentMessages: frequentMessages,
            nightPct: nightPct,
            suspicion: suspicion,
            createdAt: Date.now()
        };
    }

    function persistLegacy(d) {
        try {
            localStorage.setItem('deletedMsgs', d.deletedMsgs);
            localStorage.setItem('deletedMedia', d.deletedMedia);
            localStorage.setItem('hiddenContacts', d.hiddenContacts);
            localStorage.setItem('lateNightCount', d.lateNightChats);
        } catch (e) {}
    }

    function normalize(phone) {
        return String(phone || '').replace(/\D/g, '') || 'anon';
    }

    window.ZapDossier = {
        /**
         * Returns the coherent dossier for the given target phone, generating
         * (and caching) it once. Subsequent calls for the same number — on any
         * page — return the identical object.
         */
        get: function (phone, gender) {
            var clean = normalize(phone);
            var cached = null;
            try { cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) {}
            if (cached && cached.phone === clean && cached.v === 1) {
                persistLegacy(cached);
                return cached;
            }
            var d = build(clean, gender);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
            persistLegacy(d);
            return d;
        },
        /** Read the cached dossier without (re)generating. May return null. */
        peek: function () {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
        }
    };
})();
