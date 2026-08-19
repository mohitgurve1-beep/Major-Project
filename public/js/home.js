// ==========================================
// HOME — Homepage component JavaScript
// Kept separate from script.js for clean separation.
// ==========================================
(() => {
    'use strict';

    // ==========================================
    // 1. Animated counters (Platform Statistics)
    // ==========================================
    const statNums = document.querySelectorAll('.home-stat-num');
    if (statNums.length > 0) {
        const animateCount = (el) => {
            const target = parseInt(el.dataset.target, 10) || 0;
            const duration = 1200;
            const start = performance.now();
            const step = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.floor(eased * target);
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = target;
            };
            requestAnimationFrame(step);
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCount(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        statNums.forEach(el => observer.observe(el));
    }

    // ==========================================
    // 2. Interactive Map Preview (multi-marker)
    // ==========================================
    const homeMap = document.getElementById('homeMap');
    if (homeMap && typeof mapboxgl !== 'undefined') {
        const token = homeMap.dataset.token;
        const roomsEncoded = homeMap.dataset.rooms;
        if (token && token !== 'your_mapbox_public_token' && roomsEncoded) {
            let rooms = [];
            try { rooms = JSON.parse(decodeURIComponent(roomsEncoded)); } catch (e) { rooms = []; }
            if (rooms.length > 0) {
                mapboxgl.accessToken = token;
                const map = new mapboxgl.Map({
                    container: 'homeMap',
                    style: 'mapbox://styles/mapbox/streets-v12',
                    center: [78.96, 21.15],
                    zoom: 11,
                });
                rooms.forEach(r => {
                    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
                        '<div class="home-map-popup">' +
                        (r.img ? '<img src="' + r.img + '" alt="' + r.title + '">' : '') +
                        '<strong>' + r.title + '</strong>' +
                        '<div class="popup-price">&#8377;' + Number(r.price).toLocaleString("en-IN") + '/mo</div>' +
                        '<a class="home-btn-primary btn-sm" href="/listings/' + r.id + '">View Details</a>' +
                        '</div>'
                    );
                    new mapboxgl.Marker({ color: '#2563eb' })
                        .setLngLat([r.lng, r.lat])
                        .setPopup(popup)
                        .addTo(map);
                });
            }
        }
    }
})();
