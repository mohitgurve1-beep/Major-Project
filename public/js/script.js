(() => {
    'use strict'

    // ==========================================
    // 1. Bootstrap Form Validation (preserved)
    // ==========================================
    const forms = document.querySelectorAll('.needs-validation')
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault()
                event.stopPropagation()
            }
            form.classList.add('was-validated')
        }, false)
    })

    // ==========================================
    // 2. Navbar Scroll Shadow
    // ==========================================
    const navbar = document.querySelector('.navbar')
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 10) {
                navbar.classList.add('scrolled')
            } else {
                navbar.classList.remove('scrolled')
            }
        })
    }

    // ==========================================
    // 3. Scroll Reveal Animation
    // ==========================================
    const revealElements = document.querySelectorAll('.reveal')
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible')
                    revealObserver.unobserve(entry.target)
                }
            })
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        })
        revealElements.forEach(el => revealObserver.observe(el))
    }

    // ==========================================
    // 4. Smooth Scrolling for Anchor Links
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href')
            if (targetId === '#') return
            const target = document.querySelector(targetId)
            if (target) {
                e.preventDefault()
                target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        })
    })

    // ==========================================
    // 5. Button Loading Spinner
    // ==========================================
    document.querySelectorAll('.btn-loading').forEach(btn => {
        btn.addEventListener('click', function (e) {
            if (this.disabled) return
            const originalText = this.innerHTML
            // Only show spinner if the button is inside a form (submit)
            if (this.closest('form') && !this.dataset.noSpinner) {
                this.innerHTML = `<span class="btn-spinner"></span> Processing...`
                this.disabled = true
                // Store original text to restore if needed
                this.dataset.originalText = originalText
            }
        })
    })

    // ==========================================
    // 6. Wishlist Toggle (localStorage)
    // ==========================================
    const wishlistIcons = document.querySelectorAll('.wishlist-icon')
    wishlistIcons.forEach(icon => {
        const listingId = icon.dataset.id
        // Load saved state
        const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]')
        if (wishlist.includes(listingId)) {
            icon.classList.add('active')
            icon.querySelector('i').classList.remove('fa-regular')
            icon.querySelector('i').classList.add('fa-solid')
        }

        icon.addEventListener('click', function (e) {
            e.preventDefault()
            e.stopPropagation()
            const id = this.dataset.id
            let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]')
            const iEl = this.querySelector('i')

            if (wishlist.includes(id)) {
                wishlist = wishlist.filter(w => w !== id)
                this.classList.remove('active')
                iEl.classList.remove('fa-solid')
                iEl.classList.add('fa-regular')
            } else {
                wishlist.push(id)
                this.classList.add('active')
                iEl.classList.remove('fa-regular')
                iEl.classList.add('fa-solid')
            }
            localStorage.setItem('wishlist', JSON.stringify(wishlist))
        })
    })

    // ==========================================
    // 7. Gallery Thumbnail Click
    // ==========================================
    const galleryMain = document.getElementById('galleryMain')
    const galleryThumbs = document.querySelectorAll('.gallery-thumb')
    if (galleryMain && galleryThumbs.length > 0) {
        galleryThumbs.forEach(thumb => {
            thumb.addEventListener('click', function () {
                const src = this.getAttribute('src')
                if (src) {
                    galleryMain.setAttribute('src', src)
                    galleryThumbs.forEach(t => t.classList.remove('active'))
                    this.classList.add('active')
                }
            })
        })
    }

    // ==========================================
    // 8. Auto-close Flash Messages
    // ==========================================
    const flashAlerts = document.querySelectorAll('.alert-dismissible')
    flashAlerts.forEach(alert => {
        setTimeout(() => {
            alert.classList.add('fade')
            setTimeout(() => {
                if (alert.parentNode) alert.parentNode.removeChild(alert)
            }, 300)
        }, 5000)
    })

    // ==========================================
    // 9. Mobile Navbar Dropdown Enhancement
    // ==========================================
    const navbarToggler = document.querySelector('.navbar-toggler')
    const navbarCollapse = document.querySelector('.navbar-collapse')
    if (navbarToggler && navbarCollapse) {
        // Close mobile menu on nav link click
        navbarCollapse.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse)
                if (bsCollapse) bsCollapse.hide()
            })
        })
    }

    // ==========================================
    // 10. Card Hover Animation (parallax effect)
    // ==========================================
    const cards = document.querySelectorAll('.listing-card')
    cards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            const img = this.querySelector('.card-img-top')
            if (img) {
                img.style.transition = 'transform 0.5s ease'
            }
        })
    })

    // ==========================================
    // 11. Phase 11 — Sorting auto-submit
    //     (header sort dropdown on /listings)
    // ==========================================
    const sortSelect = document.getElementById('sortSelect')
    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            const form = document.getElementById('filterSortForm')
            if (form) form.submit()
        })
    }

    // ==========================================
    // 12. Phase 11 — Offcanvas filter drawer auto-close
    //     (apply filters closes the mobile drawer)
    // ==========================================
    const filterDrawer = document.getElementById('filterDrawer')
    if (filterDrawer && typeof bootstrap !== 'undefined') {
        // When user clicks any submit in the drawer, hide the offcanvas
        filterDrawer.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', function () {
                const instance = bootstrap.Offcanvas.getInstance(filterDrawer)
                if (instance) instance.hide()
            })
        })
    }

    // ==========================================
    // 13. Phase 11 — Amenity "select all / clear" helpers
    //     (optional small UI polish inside the sidebar)
    // ==========================================
    const amenityLists = document.querySelectorAll('.amenity-check-list')
    amenityLists.forEach(list => {
        const checkboxes = list.querySelectorAll('input[type="checkbox"][name="amenities"]')
        if (checkboxes.length === 0) return

        // Toggle a lightweight "selected count" hint next to the label
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const selected = list.querySelectorAll('input[type="checkbox"][name="amenities"]:checked').length
                const label = list.closest('.filter-group')?.querySelector('.filter-label')
                if (label) {
                    label.textContent = selected > 0
                        ? `Amenities (${selected} selected)`
                        : 'Amenities'
                }
            })
        })
    })

    console.log('UI/UX enhancements loaded successfully (Phase 11 filters active)')
})()
