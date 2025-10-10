# Default Board Update: SCNT Board → Sage Connect

**Date:** October 10, 2025  
**Change:** Updated default board name from "SCNT Board" to "Sage Connect"  
**Status:** ✅ COMPLETE

---

## 🎯 Change Summary

### What Was Changed
Updated the default board name to match the actual board name in Jira:
- **Before:** `SCNT Board` (internal/abbreviated name)
- **After:** `Sage Connect` (official board name)
- **Board ID:** `6306` (unchanged)

---

## 📝 Files Modified

### 1. `/web/src/lib/config-storage.ts`
**Primary configuration file**

```diff
export const DEFAULT_CONFIG: AppConfiguration = {
  jira: {
    boardId: '6306',
-   boardName: 'SCNT Board',
+   boardName: 'Sage Connect',
  },
  github: {
    owner: 'Sage',
    repo: 'sage-connect',
  },
  lastModified: new Date().toISOString(),
};
```

**Impact:**
- New users will see "Sage Connect" as the default board
- Reset to defaults will use "Sage Connect"
- Matches the actual board name in Jira

### 2. `/web/src/pages/Components.tsx`
**Demo/showcase page**

```diff
<Select>
- <option>SCNT Board</option>
+ <option>Sage Connect</option>
  <option>Team Board</option>
  <option>Product Board</option>
</Select>
```

**Impact:**
- Consistency in demo examples
- Users see correct board name in UI examples

---

## 🔍 Verification

### API Confirmation
```bash
curl -s "http://localhost:3000/api/boards?q=6306" | jq '.[0]'
```

**Result:**
```json
{
  "id": "6306",
  "name": "Sage Connect",  ← Official name
  "type": "scrum"
}
```

### Search Confirmation
```bash
curl -s "http://localhost:3000/api/boards?q=Sage%20Connect" | jq '.[0]'
```

**Result:**
```json
{
  "id": "6306",
  "name": "Sage Connect",
  "type": "scrum"
}
```

---

## 📊 Before vs After

### Before ❌
```typescript
DEFAULT_CONFIG = {
  jira: {
    boardId: '6306',
    boardName: 'SCNT Board',  // Abbreviated/internal name
  }
}
```

**Issues:**
- Name didn't match Jira
- Inconsistent with search results
- Could confuse users

### After ✅
```typescript
DEFAULT_CONFIG = {
  jira: {
    boardId: '6306',
    boardName: 'Sage Connect',  // Official Jira name
  }
}
```

**Benefits:**
- Matches official board name in Jira
- Consistent with BoardSelector search results
- Clear and recognizable to users
- Professional appearance

---

## 🎯 User Impact

### Configuration Card
When users open the ConfigurationCard component, they'll now see:

```
Board: [Sage Connect]  ← Dropdown shows official name
Current: 6306 (Sage Connect)  ← Consistent naming
```

### Dashboard
```
Active Sprint
Sage Connect  ← Official board name
Sprint 2024-10-01
```

### Board Selector
```
[Search input: "Type to search 2,900+ boards..."]

Results:
✓ Sage Connect (SCNT) - Scrum  ← Selected by default
```

---

## 🔄 Migration Notes

### Existing Users
- **No action required** - Existing localStorage configurations remain unchanged
- Users who already have custom board selections are unaffected
- Only affects new users or users who reset to defaults

### New Users
- Will see "Sage Connect" as the default board
- Clearer initial configuration
- Matches what they see in Jira

### Reset to Defaults
When users click "Reset to Defaults":
```typescript
resetConfig() // Returns config with boardName: 'Sage Connect'
```

---

## 📚 Related Information

### Board Details
- **Board ID:** 6306
- **Board Name:** Sage Connect
- **Project Key:** SCNT (Sage Connect)
- **Board Type:** Scrum
- **Primary Use:** Main development board for Sage Connect project

### Alternative Names
Users can search for this board using any of:
- "Sage Connect" (official name)
- "6306" (board ID)
- "SCNT" (project key)
- All variations work in BoardSelector search

---

## ✅ Testing Checklist

- [x] Updated default configuration
- [x] Updated demo/components page
- [x] Verified no TypeScript errors
- [x] Confirmed board name matches Jira API
- [x] Verified BoardSelector shows correct name
- [x] Checked search still works for "SCNT"
- [x] Confirmed existing user configs unaffected
- [x] Documented changes

---

## 🚀 Next Steps

### Optional Enhancements
1. **Add Board Alias Support**
   ```typescript
   interface Board {
     id: string;
     name: string;
     aliases?: string[];  // e.g., ["SCNT Board", "SCNT"]
   }
   ```

2. **Show Project Key in Default Display**
   ```tsx
   boardName: 'Sage Connect (SCNT)'  // Include project key
   ```

3. **Add Tooltip with Board Info**
   ```tsx
   <Tooltip content="Board ID: 6306 | Project: SCNT">
     <span>Sage Connect</span>
   </Tooltip>
   ```

---

## 📖 References

- Configuration Storage: `/web/src/lib/config-storage.ts`
- Board Selector: `/web/src/components/BoardSelector.tsx`
- Sprint Constants: `/web/src/constants/sprint.ts`
- API Documentation: `/docs/api-documentation.md`

---

**Status:** ✅ Complete  
**Deployed:** Ready  
**Breaking Changes:** None (backward compatible)
