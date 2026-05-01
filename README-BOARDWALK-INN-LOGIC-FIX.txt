Boardwalk Inn Access Logic Fix

New rule:
- Do not auto-select Boardwalk Inn just because it is closest.
- Boardwalk Inn is only used when the typed place/address is actually Boardwalk Inn.
- Nearby addresses, including examples like 5757 Palm, route to either:
  - 58th Ave Beach Access
  - Seagrove
  based on which one is closer.

Added:
- assets/boardwalk-inn-access-logic-fix.js

Test:
- Type 5757 Palm / 5757 Palm Blvd.
- It should no longer show Boardwalk Inn as selected access.
- It should correct to 58th Ave Beach Access or Seagrove.
