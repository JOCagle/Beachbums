Mobile nav click fix.

Problem fixed:
- On phone, the invisible nav-links layer was covering buttons like Next / Pick Gear.
- This made taps hit Pricing/About/Blog/etc instead of the button.

Changes:
- Closed mobile menu now has pointer-events: none.
- Open mobile menu is the only time nav links can receive taps.
- Added JS to sync hamburger open/closed state.
- Page buttons/map/form controls are clickable again.
