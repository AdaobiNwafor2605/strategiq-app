import pandas as pd
from typing import Dict, List
import numpy as np
from datetime import datetime, timedelta
from utils.validators import standardize_column_name

class DataCleaner:
    @staticmethod
    def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
        """Standardize column names."""
        df.columns = df.columns.str.strip().str.lower()
        return df
    
    @staticmethod
    def clean_numeric_column(series: pd.Series) -> pd.Series:
        """Clean numeric columns, handling currency symbols and commas."""
        if series.dtype == object:
            # Remove currency symbols and commas
            series = series.str.replace(r'[£$,]', '', regex=True)
            # Convert to numeric, coerce errors to NaN
            series = pd.to_numeric(series, errors='coerce')
        return series

    @staticmethod
    def clean_date_column(series: pd.Series) -> pd.Series:
        """Convert date strings to datetime objects, auto-detecting DD/MM vs MM/DD format."""
        parsed_default = pd.to_datetime(series, errors='coerce')
        parsed_dayfirst = pd.to_datetime(series, errors='coerce', dayfirst=True)
        # Use whichever parse produces fewer NaTs — handles US, EU/UK, and ISO formats
        if parsed_dayfirst.isna().sum() < parsed_default.isna().sum():
            return parsed_dayfirst
        return parsed_default

    def clean_dataframe(self, df: pd.DataFrame, column_mappings: Dict[str, str] = None) -> pd.DataFrame:
        """Clean and standardize a DataFrame with robust null and zero handling."""
        # Apply column mappings if provided
        if column_mappings:
            df = df.rename(columns=column_mappings)
        
        # Only standardize column names that weren't already mapped
        new_columns = []
        for col in df.columns:
            if column_mappings and col in column_mappings.values():
                # This column was already mapped to a standard name, keep it as is
                new_columns.append(col)
            else:
                # Standardize this column name
                new_columns.append(standardize_column_name(col))
        
        # Check for duplicates and handle them
        seen_columns = set()
        final_columns = []
        for col in new_columns:
            if col in seen_columns:
                # Add a suffix to make it unique
                counter = 1
                original_col = col
                while col in seen_columns:
                    col = f"{original_col}_{counter}"
                    counter += 1
            seen_columns.add(col)
            final_columns.append(col)
        
        df.columns = final_columns
        
        # Handle date columns - auto-detect DD/MM vs MM/DD format
        date_columns = ['order_date', 'paid_at', 'fulfilled_at', 'created_at']
        for col in date_columns:
            if col in df.columns:
                df[col] = DataCleaner.clean_date_column(df[col])
        
        # Convert numeric columns - expanded list with robust null/zero handling
        numeric_columns = ['quantity', 'unit_price', 'total', 'subtotal', 'shipping', 'taxes', 'discount_amount', 'total_spent', 'total_orders']
        for col in numeric_columns:
            if col in df.columns:
                # Handle currency symbols and formatting
                if df[col].dtype == object:
                    # Replace empty strings and 'null' text with NaN
                    df[col] = df[col].astype(str).replace(['', 'null', 'NULL', 'None', 'nan', 'NaN'], np.nan)
                    # Remove currency symbols and commas
                    df[col] = df[col].str.replace(r'[£$€¥,]', '', regex=True)
                
                # Convert to numeric, coerce errors to NaN
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
                # Handle specific cases for core columns
                if col == 'quantity':
                    # Quantity of 0 is valid, but null should be filled with 1
                    df[col] = df[col].fillna(1)
                    # Ensure no negative quantities
                    df[col] = df[col].abs()
                elif col == 'unit_price':
                    # Unit price of 0 might be valid (free items), but handle nulls
                    df[col] = df[col].fillna(0)
                    # Ensure no negative prices
                    df[col] = df[col].abs()
                elif col == 'total':
                    # Total of 0 might be valid, but handle nulls
                    df[col] = df[col].fillna(0)
                    # Ensure no negative totals
                    df[col] = df[col].abs()
        
        # Handle boolean columns with robust null handling
        boolean_columns = ['accepts_marketing', 'accepts_email_marketing', 'accepts_sms_marketing', 'lineitem_taxable', 'lineitem_requires_shipping']
        for col in boolean_columns:
            if col in df.columns:
                # Convert various formats to boolean, handle nulls
                df[col] = df[col].astype(str).str.lower().replace(['', 'null', 'NULL', 'None', 'nan', 'NaN'], 'false')
                df[col] = df[col].map({
                    'true': True, 'yes': True, '1': True, 'y': True,
                    'false': False, 'no': False, '0': False, 'n': False
                }).fillna(False)
        
        # Strip string columns - expanded list with null handling
        string_columns = ['customer_email', 'product_name', 'customer_location', 'customer_name', 
                         'financial_status', 'fulfillment_status', 'currency', 'phone', 'country',
                         'lineitem_name', 'lineitem_sku', 'payment_method', 'billing_name', 'shipping_name',
                         'order_id', 'customer_id']
        for col in string_columns:
            if col in df.columns:
                # Handle nulls and empty strings
                df[col] = df[col].astype(str).replace(['nan', 'NaN', 'None', 'NULL'], '')
                df[col] = df[col].str.strip()
                
                # Handle core required string columns
                if col == 'customer_email':
                    # Remove rows with invalid emails
                    df = df[df[col].str.contains('@', na=False)]
                elif col == 'order_id':
                    # Remove rows with missing order IDs
                    df = df[df[col] != '']
                elif col == 'product_name':
                    # Fill missing product names with placeholder
                    df[col] = df[col].replace('', 'Unknown Product')
        
        # Drop duplicates based on order_id if present
        if 'order_id' in df.columns:
            df = df.drop_duplicates(subset=['order_id'])
        else:
            df = df.drop_duplicates()
        
        # Final validation - remove rows where core required fields are still null/empty
        core_required = ['customer_email', 'total']
        for col in core_required:
            if col in df.columns:
                if col == 'customer_email':
                    df = df[df[col] != '']
                elif col == 'total':
                    # Keep rows with total=0 (valid), but remove nulls
                    df = df[df[col].notna()]
        
        # Fill remaining missing values with sensible defaults
        fill_defaults = {
            'quantity': 1,
            'financial_status': 'unknown',
            'fulfillment_status': 'unfulfilled',
            'currency': 'USD',
            'shipping': 0,
            'taxes': 0,
            'discount_amount': 0,
            'customer_location': 'Unknown'
        }
        
        for col, default_val in fill_defaults.items():
            if col in df.columns:
                df[col] = df[col].fillna(default_val)
        
        return df

    @staticmethod
    def merge_dataframes(dataframes: List[pd.DataFrame]) -> pd.DataFrame:
        """Merge multiple DataFrames based on common columns."""
        # Start with the DataFrame that has order_id
        main_df = None
        other_dfs = []
        
        for df in dataframes:
            if 'order_id' in df.columns:
                if main_df is None:
                    main_df = df
                else:
                    other_dfs.append(df)
            else:
                other_dfs.append(df)
        
        if main_df is None:
            raise ValueError("No DataFrame contains order_id column")
        
        # Merge additional DataFrames
        for df in other_dfs:
            merge_cols = list(set(main_df.columns) & set(df.columns))
            if merge_cols:
                main_df = main_df.merge(df, on=merge_cols, how='left')
        
        return main_df 