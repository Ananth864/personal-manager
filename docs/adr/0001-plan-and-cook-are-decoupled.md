# Plan and Cook are decoupled

Mutating the Schedule — assigning, swapping, or clearing recipes in Meal Slots — never touches Inventory. Ingredient consumption happens only via a Cook, an explicit logged event.

Rejected alternative: a coupled model where assigning a recipe to a slot immediately decrements Inventory. Rejected because plan churn (swapping Tuesday and Wednesday, overriding a planned meal with Eating Out, re-planning after a shop) would require reverse-decrements and re-decrements on every edit, block writing down meals you can't currently make but intend to shop for, and leave phantom consumption when a planned meal isn't actually cooked. Decoupling gives the "can't cook if unavailable" rule a single evaluation point (cook time) and lets the Schedule serve double duty as a shopping list without lying about what's on hand.
