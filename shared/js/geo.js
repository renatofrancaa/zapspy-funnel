/**
 * Visitor geolocation — real location of the person accessing the page.
 * Priority:
 *   1) Browser GPS / high-accuracy position (when permission granted)
 *   2) Reverse-geocode via OpenStreetMap Nominatim
 *   3) IP geolocation fallbacks (ipwho.is → geojs → ipapi.co)
 *
 * Does NOT call zappdetect / railway. Results cached in localStorage.
 */
(function () {
  'use strict';
  if (window.__geoShimInstalled) return;
  window.__geoShimInstalled = true;

  var CACHE_KEY = '__visitorGeo_v2';
  var CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
  var _inflight = null;
  var _resolved = null;

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.t || Date.now() - parsed.t > CACHE_TTL_MS) return null;
      return parsed.d || null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data }));
      if (data.city) localStorage.setItem('userCity', data.city);
      if (data.state) localStorage.setItem('userState', data.state);
      if (data.country_code || data.country) {
        localStorage.setItem('userCountryCode', data.country_code || data.country);
        localStorage.setItem('userCountry', data.country_code || data.country);
      }
      if (data.latitude != null) localStorage.setItem('userLat', String(data.latitude));
      if (data.longitude != null) localStorage.setItem('userLon', String(data.longitude));
      localStorage.setItem(
        'userGeo',
        JSON.stringify({
          city: data.city || '',
          state: data.state || '',
          country: data.country_code || data.country || '',
          lat: data.latitude || 0,
          lon: data.longitude || 0,
          source: data.source || 'ip'
        })
      );
    } catch (e) {}
  }

  function normalize(data) {
    if (!data) return null;
    var city = data.city || data.town || data.village || data.municipality || data.county || '';
    var state = data.state || data.region || data.regionName || data.region_name || '';
    var country = data.country_code || data.countryCode || data.country || '';
    if (country && country.length > 2 && data.country_code) country = data.country_code;
    country = String(country || '').toUpperCase();
    var lat = parseFloat(data.latitude != null ? data.latitude : data.lat);
    var lon = parseFloat(data.longitude != null ? data.longitude : data.lon);
    if (!city && !lat) return null;
    return {
      success: true,
      city: city,
      state: state,
      region: state,
      country: country,
      country_code: country,
      latitude: isFinite(lat) ? lat : 0,
      longitude: isFinite(lon) ? lon : 0,
      source: data.source || 'ip',
      device: data.device || null,
      browser: data.browser || null
    };
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      try {
        if (ctrl) ctrl.abort();
      } catch (e) {}
    }, timeoutMs || 5000);
    return fetch(url, {
      signal: ctrl ? ctrl.signal : undefined,
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function browserPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      var done = false;
      var finish = function (v) {
        if (done) return;
        done = true;
        resolve(v);
      };
      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            finish({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              source: 'gps'
            });
          },
          function () {
            finish(null);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      } catch (e) {
        finish(null);
      }
      // hard timeout so we never hang the funnel
      setTimeout(function () {
        finish(null);
      }, 9000);
    });
  }

  function reverseGeocode(lat, lon) {
    // bigdatacloud is CORS-friendly for browsers (no key for client reverse-geocode)
    var url =
      'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
      encodeURIComponent(lat) +
      '&longitude=' +
      encodeURIComponent(lon) +
      '&localityLanguage=en';
    return fetchJson(url, 6000)
      .then(function (d) {
        return normalize({
          city: d.city || d.locality || d.principalSubdivision,
          region: d.principalSubdivision || d.localityInfo && d.localityInfo.administrative && d.localityInfo.administrative[0] && d.localityInfo.administrative[0].name,
          country_code: d.countryCode,
          latitude: lat,
          longitude: lon,
          source: 'gps'
        });
      })
      .catch(function () {
        // fallback Nominatim (may fail CORS in some browsers)
        var url2 =
          'https://nominatim.openstreetmap.org/reverse?lat=' +
          encodeURIComponent(lat) +
          '&lon=' +
          encodeURIComponent(lon) +
          '&format=json&addressdetails=1';
        return fetchJson(url2, 6000).then(function (d) {
          var a = (d && d.address) || {};
          return normalize({
            city: a.city || a.town || a.village || a.municipality || a.suburb || a.county,
            state: a.state || a.region,
            country_code: a.country_code ? String(a.country_code).toUpperCase() : '',
            latitude: lat,
            longitude: lon,
            source: 'gps'
          });
        });
      });
  }

  function ipGeoChain() {
    // Prefer providers that return city + lat/lon for the visitor IP
    var providers = [
      function () {
        return fetchJson('https://ipwho.is/', 4500).then(function (d) {
          if (d && d.success === false) throw new Error('ipwho fail');
          return normalize({
            city: d.city,
            region: d.region,
            country_code: d.country_code,
            latitude: d.latitude,
            longitude: d.longitude,
            source: 'ipwho'
          });
        });
      },
      function () {
        return fetchJson('https://get.geojs.io/v1/ip/geo.json', 4500).then(function (d) {
          return normalize({
            city: d.city,
            region: d.region,
            country_code: d.country_code || d.country,
            latitude: d.latitude,
            longitude: d.longitude,
            source: 'geojs'
          });
        });
      },
      function () {
        return fetchJson('https://ipapi.co/json/', 4500).then(function (d) {
          if (d && d.error) throw new Error(d.reason || 'ipapi error');
          return normalize({
            city: d.city,
            region: d.region,
            country_code: d.country_code,
            latitude: d.latitude,
            longitude: d.longitude,
            source: 'ipapi'
          });
        });
      },
      function () {
        return fetchJson('https://ipapi.co/json/?fields=city,region,country_code,latitude,longitude', 4500).then(
          function (d) {
            return normalize({
              city: d.city,
              region: d.region,
              country_code: d.country_code,
              latitude: d.latitude,
              longitude: d.longitude,
              source: 'ipapi2'
            });
          }
        );
      }
    ];

    var i = 0;
    function next() {
      if (i >= providers.length) return Promise.resolve(null);
      var fn = providers[i++];
      return fn().catch(function () {
        return next();
      });
    }
    return next();
  }

  /**
   * Resolve visitor geo once; subsequent calls reuse the promise/cache.
   */
  function resolveVisitorGeo(opts) {
    opts = opts || {};
    if (_resolved && !opts.force) return Promise.resolve(_resolved);
    if (_inflight && !opts.force) return _inflight;

    var cached = readCache();
    if (cached && cached.city && !opts.force) {
      _resolved = cached;
      return Promise.resolve(cached);
    }

    _inflight = (async function () {
      // 1) GPS (most exact when allowed)
      try {
        var pos = await browserPosition();
        if (pos && isFinite(pos.latitude) && isFinite(pos.longitude)) {
          try {
            var rev = await reverseGeocode(pos.latitude, pos.longitude);
            if (rev && rev.city) {
              rev.latitude = pos.latitude;
              rev.longitude = pos.longitude;
              rev.source = 'gps';
              writeCache(rev);
              _resolved = rev;
              return rev;
            }
          } catch (e) {}
          // GPS coords without reverse geocode still useful for map
          var bare = normalize({
            city: localStorage.getItem('userCity') || '',
            region: localStorage.getItem('userState') || '',
            country_code: localStorage.getItem('userCountryCode') || '',
            latitude: pos.latitude,
            longitude: pos.longitude,
            source: 'gps'
          });
          // Prefer IP for city name if reverse failed
          var ipFill = await ipGeoChain();
          if (ipFill) {
            bare.city = bare.city || ipFill.city;
            bare.state = bare.state || ipFill.state;
            bare.region = bare.region || ipFill.region;
            bare.country = bare.country || ipFill.country;
            bare.country_code = bare.country_code || ipFill.country_code;
            // keep GPS lat/lon for precision
            bare.latitude = pos.latitude;
            bare.longitude = pos.longitude;
            bare.source = 'gps+ip';
          }
          if (bare.city || bare.latitude) {
            writeCache(bare);
            _resolved = bare;
            return bare;
          }
        }
      } catch (e) {}

      // 2) IP geolocation
      var ip = await ipGeoChain();
      if (ip) {
        writeCache(ip);
        _resolved = ip;
        return ip;
      }

      // 3) Last resort from any stale localStorage
      var fallback = normalize({
        city: localStorage.getItem('userCity') || '',
        region: localStorage.getItem('userState') || '',
        country_code: localStorage.getItem('userCountryCode') || '',
        latitude: parseFloat(localStorage.getItem('userLat') || '0'),
        longitude: parseFloat(localStorage.getItem('userLon') || '0'),
        source: 'cache'
      });
      _resolved = fallback;
      return fallback;
    })().finally(function () {
      _inflight = null;
    });

    return _inflight;
  }

  window.resolveVisitorGeo = resolveVisitorGeo;
  window.__visitorGeo = function () {
    return _resolved || readCache();
  };

  // Kick off early so DDI + map are ready by the time user reaches analysis
  try {
    resolveVisitorGeo();
  } catch (e) {}
})();
