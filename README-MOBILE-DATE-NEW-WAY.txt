Mobile date picker fix - new way

This version stops trying to force Booqable's broken mobile popover above the page.
On phone sizes, it hides the embedded Booqable datepicker offscreen and shows a clean full-screen mobile calendar instead.
When Apply is pressed, it syncs the selected dates back into Booqable using API-style calls, DOM input/change events, and a fallback hidden-picker click routine.
Desktop is untouched.
