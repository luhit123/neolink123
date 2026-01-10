# Smart Data Retrieval Guide

## Problem Solved
Your old system tried to include ALL patient data in every AI prompt, making prompts too large. The new system **intelligently searches and retrieves only relevant data** before asking the AI.

## How It Works

### Old Approach (Prompt-Based)
```
User asks: "Show me NICU patients with low birth weight"
     ↓
System includes ALL patients in prompt (could be 1000s of patients)
     ↓
AI reads through all data and filters
     ↓
Response
```
**Problem**: Prompt becomes huge with large datasets.

### New Approach (RAG - Retrieval Augmented Generation)
```
User asks: "Show me NICU patients with low birth weight"
     ↓
Step 1: AI analyzes query → "User wants: unit=NICU, birthWeight<2.5kg"
     ↓
Step 2: Search database → Returns only 15 matching patients
     ↓
Step 3: Send ONLY those 15 patients to AI
     ↓
Response (fast and accurate)
```
**Benefits**:
- Smaller prompts
- Faster responses
- Can handle any size database
- More accurate answers

## Migration Steps

### Option 1: Direct Replacement (Recommended)

Simply update your import in `AIChatPanel.tsx`:

**Before:**
```typescript
import { handleComplexQuery } from '../services/aiChatService';
```

**After:**
```typescript
import { handleComplexQuery } from '../services/aiChatServiceV2';
```

That's it! The new service has the same function name and signature, so no other code changes needed.

### Option 2: Gradual Migration

Keep both services and test the new one:

```typescript
import { handleComplexQuery as handleComplexQueryOld } from '../services/aiChatService';
import { handleComplexQuery as handleComplexQueryNew } from '../services/aiChatServiceV2';

// Use new system
const aiResponse = await handleComplexQueryNew(
  messageText,
  context,
  patients,
  conversationHistory
);
```

## What The System Does Automatically

### 1. Query Understanding
The AI analyzes questions like:
- "Show me all deceased NICU patients" → Filters: unit=NICU, outcome=Deceased
- "How many babies with ELBW were admitted today?" → Filters: birthWeight<1kg, dateRange=today
- "List patients with sepsis" → Filters: diagnosis contains "sepsis"

### 2. Smart Data Retrieval
Only retrieves relevant patients:
- Applies all detected filters
- Limits results (default: 50 patients max)
- Sorts if needed
- Generates appropriate summary

### 3. Aggregation Types
Automatically chooses the right format:
- **Individual**: Detailed patient list
- **Summary**: Quick counts and percentages
- **Statistics**: In-depth analysis with breakdowns
- **Trends**: Time-based patterns

## Examples

### Example 1: Large Dataset Query
**Question**: "How many patients were admitted to NICU in December?"

**What happens**:
1. Query analysis: `{ filters: { units: ["NICU"], dateRange: "December" } }`
2. Database search: Finds 45 matching patients
3. Summary generated: "45 patients admitted to NICU in December..."
4. AI receives: Just the summary (not 45 full patient records)
5. AI responds: With accurate count and analysis

**Prompt size**: ~500 tokens (vs ~5000+ tokens with old method)

### Example 2: Specific Patient Search
**Question**: "Show me all babies with birth weight less than 1kg who are still in progress"

**What happens**:
1. Query analysis: `{ filters: { birthWeightRange: { max: 1 }, outcomes: ["In Progress"] }, aggregationType: "individual" }`
2. Database search: Finds 8 matching patients
3. Detailed records: Only those 8 patients with full details
4. AI responds: With formatted list of the 8 patients

### Example 3: General Clinical Question
**Question**: "What is respiratory distress syndrome?"

**What happens**:
1. System detects: Not a database query (no patient/admission/mortality keywords)
2. Routes to: Clinical Q&A (no database search needed)
3. AI responds: With medical information

## Configuration

### Adjust Retrieval Limits
In `smartDataRetrieval.ts`, modify defaults:

```typescript
if (!dataQuery.limit) dataQuery.limit = 100; // Increase from 50 to 100
```

### Add Custom Filters
Add new filter types in the `DataQuery` interface:

```typescript
export interface DataQuery {
  filters: {
    // ... existing filters
    customField?: string; // Your new filter
  };
  // ...
}
```

Then implement in `retrieveRelevantData()`.

## Performance Benefits

### Prompt Size Reduction
- **Before**: 1000 patients × 200 tokens = 200,000 tokens (exceeds limits!)
- **After**: 50 patients × 200 tokens = 10,000 tokens (fits comfortably)

### Response Time
- **Before**: 10-30 seconds (large prompt processing)
- **After**: 3-5 seconds (focused data only)

### Accuracy
- **Before**: AI might miss details in large datasets
- **After**: AI focuses on relevant subset, better accuracy

## Troubleshooting

### Query not finding patients?
Check the console for query analysis:
```
🔍 Query Analysis: { filters: {...}, aggregationType: "summary" }
📊 Retrieved 0 of 0 matching patients
```

The query analysis might be incorrect. You can:
1. Refine your question to be more specific
2. Add more keywords
3. Adjust the `analyzeQueryIntent` function to better handle your use case

### Want to see what's being searched?
All search operations are logged:
```javascript
console.log('🔍 Step 1: Analyzing query intent...');
console.log('📊 Step 2: Retrieving relevant data...');
console.log('🤖 Step 3: Generating AI response...');
console.log('✅ Query completed successfully');
```

## Best Practices

1. **Ask specific questions**: "Show me NICU patients admitted today" (good) vs "Show me patients" (too broad)

2. **Use medical terminology**: The system recognizes ELBW, VLBW, LBW, and other abbreviations

3. **Combine filters**: "Deceased NICU patients with birth weight under 1kg in December"

4. **For large results**: The system automatically limits and summarizes

5. **Follow-up questions**: The system remembers conversation history (last 4 messages)

## Next Steps

1. **Test** the new system with your existing queries
2. **Monitor** the console logs to see how queries are being analyzed
3. **Tune** the query analysis prompt if needed for your specific use cases
4. **Extend** with custom filters for your specific fields

## Advanced: Adding Vector Search (Optional)

For even more sophisticated semantic search, consider adding vector embeddings:

```typescript
// Store patient data as embeddings
// Search using semantic similarity
// Retrieve most relevant patients even with fuzzy queries
```

This is optional and only needed for very large datasets (10,000+ patients) or complex semantic queries.
