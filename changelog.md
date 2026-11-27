# Changelog

# Version 1.2.0

- Check-in and check-out from the reserves list. The buttons show up only when Deskbee allows the action, so the extension never guesses the check-in window.
- A reserve with check-in done can only be checked out: cancel and batch selection are blocked, with the reason on hover.
- Editing a checked-in reserve warns first and asks for confirmation, because Deskbee edits by canceling and recreating (the check-in is probably lost).
- The list refreshes every minute while the popup is open, so the check-in button appears when the window opens.

# Version 1.1.0

- Edit reserves: change check-in, check-out and desk of one reserve (pencil on the row) or many at once ("Edit selected"), with a before/after review. Empty fields keep each reserve's current value.
- Deskbee edits by canceling and recreating, so each edit sends a cancellation email and a new-booking email.
- MIT license added, so the extension can be used and modified freely.

# Version 1.0.0

First release.

- Batch booking: desk, date range, weekdays and a default time, with a different time for specific weekdays.
- Preview before booking: skips days already booked and dates beyond the company's booking window.
- Secondary desks, tried in order when the main desk is taken.
- Presets to save and reuse a booking setup.
- Cancel one reserve or many at once, with a date, weekday and desk filter.
- Batches run in the background, so closing the popup doesn't stop them.
- Works with any company's Deskbee: company, floor and app version are detected automatically and can be overridden in Options.
- Detached window with a side-by-side layout on wide screens.
- Light and dark themes, Portuguese and English.
- Update notice: checks GitHub releases once a day (badge on the icon, notice in the popup, manual check in Options).
