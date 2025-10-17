# Velocity Page - Card Information Breakdown

**Date:** October 17, 2025  
**Topic:** Understanding the difference between cards on the Velocity page  
**Status:** ✅ CLARIFIED

---

## 🎯 Overview

The Velocity page has **5 main sections** showing different aspects of sprint velocity data. Each serves a unique purpose and presents information differently.

---

## 📊 Card Breakdown

### 1. **Configuration Card**
**Purpose:** Shows current settings
- Board name and ID
- Sprint count selector

**Value:** Confirms which data you're viewing

---

### 2. **Average Velocity Card** (Metric)
**Type:** Metric Card (Small)
**Shows:** Single number - average velocity
**Example:** `42` story points per sprint

**Calculation:**
```typescript
average = sum of all sprint velocities / number of sprints
```

**Value:** Quick reference for team capacity planning

---

### 3. **Velocity Trend Card** (Metric)
**Type:** Metric Card (Small)
**Shows:** Trend direction (Increasing/Decreasing/Stable)
**Example:** `Increasing` with description "Team velocity is improving over time"

**Calculation:**
```typescript
// Compares recent sprints to older sprints
if (recent velocity > older velocity) = "increasing"
if (recent velocity < older velocity) = "decreasing"
else = "stable"
```

**Value:** At-a-glance understanding of team performance trajectory

---

### 4. **Sprints Analyzed Card** (Metric)
**Type:** Metric Card (Small)
**Shows:** Count of sprints included in analysis
**Example:** `5` completed sprints

**Value:** Confirms data sample size for statistical validity

---

### 5. **Sprint Performance Card** (Table)
**Type:** Detailed Data Table
**Shows:** Granular sprint-by-sprint breakdown

**Columns:**
- **Sprint:** Sprint name (e.g., "Sprint 42")
- **Commitment:** Planned story points
- **Completed:** Actual completed story points
- **Velocity:** Completed points (same as completed)
- **Completion %:** (Completed / Commitment) × 100

**Example Data:**
| Sprint | Commitment | Completed | Velocity | Completion % |
|--------|------------|-----------|----------|--------------|
| Sprint 42 | 50 | 45 | 45 | 90% ✅ |
| Sprint 41 | 48 | 48 | 48 | 100% 🎯 |
| Sprint 40 | 52 | 35 | 35 | 67% ⚠️ |

**Value:** 
- Detailed analysis of each sprint
- Identify patterns in under/over-commitment
- Track completion consistency

---

### 6. **Velocity History Card** (Chart) *(Previously "Velocity Trend")*
**Type:** Horizontal Bar Chart Visualization
**Shows:** Visual comparison of velocity across all sprints

**Display:**
- Sprint name on left
- Velocity value on right
- Proportional bar showing relative velocity
- Longest bar = highest velocity sprint

**Example:**
```
Sprint 42 ████████████████░░░░ 45
Sprint 41 ████████████████████ 48  ← Highest
Sprint 40 ████████████░░░░░░░░ 35
```

**Value:**
- Quick visual pattern recognition
- Easy to spot velocity spikes/drops
- Complements the table with visual context

---

## 🔍 Key Differences

### **Sprint Performance Table vs Velocity History Chart**

| Aspect | Sprint Performance (Table) | Velocity History (Chart) |
|--------|----------------------------|--------------------------|
| **Format** | Data table | Bar chart visualization |
| **Detail Level** | High - 5 columns of data | Low - just sprint & velocity |
| **Best For** | Detailed analysis | Quick visual comparison |
| **Shows** | Commitment, Completed, Completion % | Only velocity (completed points) |
| **Use Case** | Understanding why velocity changed | Seeing velocity patterns at a glance |

---

## ❓ Do They Add Value?

### **Yes! Here's Why:**

#### **Sprint Performance Table Adds:**
1. **Commitment Data** - Shows if team over/under-commits
2. **Completion Rate** - Reveals sprint execution quality
3. **Progress Visualization** - Color-coded progress bars
4. **Accountability** - Clear metrics for retrospectives

#### **Velocity History Chart Adds:**
1. **Visual Pattern Recognition** - Easier to spot trends
2. **Quick Comparison** - No need to read numbers
3. **Presentation Ready** - Great for stakeholder demos
4. **Accessibility** - Different learning styles (visual vs numerical)

---

## 💡 When to Use Each

### **Use Sprint Performance Table When:**
- ✅ Analyzing sprint planning accuracy
- ✅ Identifying systematic over/under-commitment
- ✅ Preparing for retrospectives
- ✅ Need exact numbers for calculations
- ✅ Looking for completion rate issues

### **Use Velocity History Chart When:**
- ✅ Quick status check
- ✅ Presenting to stakeholders
- ✅ Looking for visual patterns
- ✅ Comparing sprint-to-sprint consistency
- ✅ Want to see trends without numbers

---

## 📈 Real-World Example

### Scenario: Team's last 5 sprints

**Metric Cards Show:**
- Average Velocity: **45 points**
- Trend: **Stable**
- Sprints Analyzed: **5**

**Table Reveals:**
```
Sprint 45: 50 committed → 45 completed (90%) ⚠️ Under-delivered
Sprint 44: 48 committed → 48 completed (100%) ✅ Perfect
Sprint 43: 50 committed → 45 completed (90%) ⚠️ Under-delivered
Sprint 42: 46 committed → 46 completed (100%) ✅ Perfect
Sprint 41: 48 committed → 42 completed (88%) ⚠️ Under-delivered
```

**Insights from Table:**
- Team consistently commits to ~48-50 points
- But only completes ~45 points on average
- **Recommendation:** Reduce commitment to 45 points

**Chart Shows:**
```
Sprint 45 ████████████████░░ 45
Sprint 44 ████████████████░░ 48  ← Peak
Sprint 43 ████████████████░░ 45
Sprint 42 ████████████████░░ 46
Sprint 41 ██████████████░░░░ 42  ← Low
```

**Insights from Chart:**
- Velocity is relatively consistent
- Slight dip in Sprint 41
- Visual confirmation of "stable" trend

---

## 🎯 Summary

### **They Don't Duplicate - They Complement!**

- **Metric Cards** = Quick overview
- **Table** = Detailed analysis (commitment, completion, percentages)
- **Chart** = Visual storytelling

Each card provides **unique value** and serves **different use cases**. Together, they give a complete picture of team velocity from multiple angles.

---

## 🔧 Recent Changes

**Fixed:** Renamed "Velocity Trend" chart to "Velocity History" to avoid confusion with the "Velocity Trend" metric card that shows increasing/decreasing/stable status.

**Now Clear:**
- ✅ **Velocity Trend** = Direction (metric card)
- ✅ **Velocity History** = Timeline visualization (chart card)
- ✅ **Sprint Performance** = Detailed data (table)

---

## 📖 Related Documentation

- `VELOCITY_PAGE_SHADCN_REFACTORING.md` - Component refactoring
- `VELOCITY_PAGE_CARD_DESCRIPTIONS.md` - Card descriptions
- `BACKEND_ANALYSIS_REPORT.md` - Velocity calculation logic
