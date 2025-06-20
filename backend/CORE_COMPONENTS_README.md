# 🔒 CORE COMPONENTS - PRODUCTION READY

## ⚠️ **CRITICAL WARNING**
These components have been tested with real customer data and are currently working in production. **DO NOT MODIFY** without extensive testing and backup.

## 📊 **Verified Data Processing Pipeline**

### ✅ **Status: PRODUCTION READY**
- **Last Tested**: December 2024
- **Test Data**: Successfully processed 48 e-commerce records
- **Data Sources**: Shopify exports, CSV files
- **Version**: 1.0.0

---

## 🔐 **Protected Files & Functions**

### **1. Core Configuration (`core_config.py`)**
```python
CORE_REQUIRED_COLUMNS    # ❌ DO NOT MODIFY
CORE_OPTIONAL_COLUMNS    # ⚠️ Safe to ADD, don't REMOVE
CORE_DATA_CLEANING_RULES # ❌ DO NOT MODIFY
```

### **2. JSON Safety Functions (`main.py`)**
```python
make_json_safe()    # ❌ DO NOT MODIFY - Prevents API crashes
safe_divide()       # ❌ DO NOT MODIFY - Handles division by zero
```

### **3. Data Cleaning Logic (`services/data_cleaner.py`)**
```python
clean_dataframe()   # ⚠️ MODIFY WITH EXTREME CAUTION
handle nulls/zeros  # ❌ DO NOT MODIFY - Handles real-world data
currency cleaning   # ❌ DO NOT MODIFY - Tested with £$€¥
```

### **4. Analytics Service (`services/analytics.py`)**
```python
safe_float()        # ❌ DO NOT MODIFY - Prevents JSON errors
safe_int()          # ❌ DO NOT MODIFY - Prevents JSON errors
timezone handling   # ❌ DO NOT MODIFY - Fixes datetime issues
```

### **5. Column Validation (`utils/validators.py`)**
```python
REQUIRED_COLUMNS    # ❌ DO NOT MODIFY - Tested column mappings
OPTIONAL_COLUMNS    # ⚠️ Safe to ADD, don't REMOVE
find_matching_columns() # ⚠️ MODIFY WITH CAUTION
```

---

## 🛡️ **Protection Mechanisms**

### **1. Startup Validation**
- System validates core config on every startup
- Fails fast if core components are corrupted
- Logs validation status

### **2. Version Tracking**
- Core components are versioned
- Last tested date is tracked
- Data sources are documented

### **3. Assertion Checks**
```python
assert len(CORE_REQUIRED_COLUMNS) == 6
assert 'order_id' in CORE_REQUIRED_COLUMNS
assert 'total' in CORE_REQUIRED_COLUMNS
```

---

## ✅ **Safe Modifications**

### **What you CAN safely change:**
1. **Add new optional columns** to `CORE_OPTIONAL_COLUMNS`
2. **Add new column name variations** to existing mappings
3. **Modify frontend components** (UI/UX changes)
4. **Add new analytics functions** (don't modify existing ones)
5. **Update styling and layouts**

### **What you CANNOT change without testing:**
1. **Required column definitions**
2. **JSON safety functions**
3. **Data cleaning null/zero handling**
4. **Currency symbol removal logic**
5. **Timezone handling in analytics**

---

## 🧪 **Testing Protocol for Core Changes**

If you MUST modify core components:

1. **Backup current working version**
2. **Test with original 48-record dataset**
3. **Verify all analytics outputs match**
4. **Test edge cases**: nulls, zeros, currency symbols, inf/nan values
5. **Verify JSON serialization works**
6. **Update version number and test date**

---

## 🚨 **Emergency Rollback**

If the system breaks after modifications:

```bash
# 1. Restore core_config.py from this commit
git checkout HEAD~1 backend/core_config.py

# 2. Restore validators.py
git checkout HEAD~1 backend/utils/validators.py

# 3. Restart system
python3 main.py
```

---

## 📞 **Support**

If you need to modify core components:
1. Create a full backup first
2. Test in a separate environment
3. Document all changes
4. Update this README with new test results

**Remember: This system successfully processes real customer data. Stability > Features.** 