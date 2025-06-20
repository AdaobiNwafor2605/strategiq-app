from typing import List, Dict, Set, Tuple
import pandas as pd
import logging
from core_config import (
    CORE_REQUIRED_COLUMNS, 
    CORE_OPTIONAL_COLUMNS, 
    validate_core_config
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Validate core configuration on import
validate_core_config()

# Use core configuration (DO NOT MODIFY - these are production tested)
REQUIRED_COLUMNS = CORE_REQUIRED_COLUMNS
OPTIONAL_COLUMNS = CORE_OPTIONAL_COLUMNS

# All columns combined for processing
COLUMN_MAPPINGS = {**REQUIRED_COLUMNS, **OPTIONAL_COLUMNS}

def standardize_column_name(col: str) -> str:
    """Convert column name to standard format."""
    col = col.lower().strip()
    logger.info(f"Standardizing column name: {col}")
    for standard, variants in COLUMN_MAPPINGS.items():
        if col in variants:
            logger.info(f"Matched {col} to standard name {standard}")
            return standard
    logger.info(f"No standard match found for {col}")
    return col

def find_matching_column(df: pd.DataFrame, possible_names: List[str]):
    """Find a matching column name from a list of possible names."""
    df_cols = [col.lower().strip() for col in df.columns]
    
    for possible_name in possible_names:
        if possible_name.lower() in df_cols:
            # Return the original column name (not lowercased)
            original_index = df_cols.index(possible_name.lower())
            return str(df.columns[original_index])
    
    return None

def find_matching_columns(df: pd.DataFrame) -> Dict[str, str]:
    """Find matching columns in DataFrame based on standard names."""
    matches = {}
    df_cols = set(col.lower().strip() for col in df.columns)
    logger.info(f"Looking for matches in columns: {df_cols}")
    
    for standard, variants in COLUMN_MAPPINGS.items():
        for variant in variants:
            if variant in df_cols:
                matches[standard] = variant
                logger.info(f"Found match: {variant} -> {standard}")
                break
    
    logger.info(f"Found matches: {matches}")
    return matches

def validate_required_columns(dataframes: List[pd.DataFrame]) -> Tuple[bool, Set[str], Set[str]]:
    """
    Validate that all REQUIRED columns are present across all dataframes combined.
    Returns: (is_valid, found_columns, missing_columns)
    """
    required_columns = set(REQUIRED_COLUMNS.keys())
    found_columns = set()
    
    logger.info(f"Required columns: {required_columns}")
    
    for df in dataframes:
        logger.info(f"Checking DataFrame with columns: {list(df.columns)}")
        matches = find_matching_columns(df)
        found_columns.update(matches.keys())
        logger.info(f"Found columns so far: {found_columns}")
    
    missing_columns = required_columns - found_columns
    is_valid = len(missing_columns) == 0
    
    logger.info(f"Missing columns: {missing_columns}")
    logger.info(f"Validation {'passed' if is_valid else 'failed'}")
    
    return is_valid, found_columns, missing_columns

def validate_dataframes(dataframes: Dict[str, pd.DataFrame]) -> Tuple[bool, List[Dict]]:
    """
    Validate that all REQUIRED columns are present across all dataframes.
    Returns (is_valid, list of missing columns per file)
    """
    found_columns: Set[str] = set()
    validation_errors = []
    
    logger.info("Starting dataframe validation")
    
    # First pass: collect all available columns
    for filename, df in dataframes.items():
        logger.info(f"Validating file: {filename}")
        logger.info(f"File columns: {list(df.columns)}")
        
        file_columns = set()
        for standard_col, possible_names in COLUMN_MAPPINGS.items():
            matched_col = find_matching_columns(df)
            if standard_col in matched_col:
                found_columns.add(standard_col)
                file_columns.add(standard_col)
                logger.info(f"Found column {standard_col} in {filename}")
        
        # Track what was found and missing in this file (only for required columns)
        missing_in_file = set(REQUIRED_COLUMNS.keys()) - file_columns
        logger.info(f"Missing required columns in {filename}: {missing_in_file}")
        
        validation_errors.append({
            "file_name": filename,
            "missing_columns": list(missing_in_file),
            "found_columns": list(file_columns)
        })

    # Check if all required columns were found across all files
    missing_required = set(REQUIRED_COLUMNS.keys()) - found_columns
    logger.info(f"Overall missing required columns: {missing_required}")
    
    return len(missing_required) == 0, validation_errors 