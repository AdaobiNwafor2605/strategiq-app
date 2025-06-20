from typing import Dict, List, Any, Tuple, BinaryIO
import pandas as pd
from fastapi import HTTPException
import numpy as np
from datetime import datetime
import logging
from utils.validators import validate_dataframes, find_matching_column, COLUMN_MAPPINGS
from services.data_cleaner import DataCleaner

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FileProcessor:
    def __init__(self):
        self.cleaner = DataCleaner()
        self.dataframes: Dict[str, pd.DataFrame] = {}
        self.sales_data = None
        self.products_data = None
        
    def read_file(self, file: BinaryIO, filename: str) -> pd.DataFrame:
        """Read a CSV or Excel file into a pandas DataFrame."""
        logger.info(f"Reading file: {filename}")
        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(file)
            elif filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file)
            else:
                raise ValueError("Unsupported file format")
            
            logger.info(f"Successfully read {filename}. Shape: {df.shape}, Columns: {list(df.columns)}")
            return df
        except Exception as e:
            logger.error(f"Error reading file {filename}: {str(e)}")
            raise

    def process_files(self, files: List[Tuple[str, BinaryIO]]) -> Dict:
        """
        Process multiple uploaded files.
        Returns a dictionary with processing results.
        """
        logger.info(f"Starting to process {len(files)} files")
        
        # Read all files
        for filename, file in files:
            try:
                logger.info(f"Processing file: {filename}")
                df = self.read_file(file, filename)
                self.dataframes[filename] = df
                logger.info(f"Successfully loaded {filename} into memory")
            except Exception as e:
                logger.error(f"Failed to process {filename}: {str(e)}")
                return {
                    "success": False,
                    "message": f"Error reading file {filename}: {str(e)}",
                    "errors": []
                }

        # Validate all required columns are present
        logger.info("Validating required columns across all files")
        is_valid, validation_errors = validate_dataframes(self.dataframes)
        
        if not is_valid:
            logger.error(f"Validation failed: {validation_errors}")
            return {
                "success": False,
                "message": "Missing required columns across all files",
                "errors": validation_errors
            }

        # Clean and process each dataframe
        try:
            cleaned_dfs = {}
            for filename, df in self.dataframes.items():
                logger.info(f"Creating column mappings for {filename}")
                # Create column mappings with duplicate prevention
                column_mappings = {}
                used_standard_names = set()
                
                # First pass: prioritize exact matches
                for original_col in df.columns:
                    original_col_lower = original_col.lower().strip()
                    for standard_col, possible_names in COLUMN_MAPPINGS.items():
                        if standard_col not in used_standard_names and original_col_lower in possible_names:
                            column_mappings[original_col] = standard_col
                            used_standard_names.add(standard_col)
                            logger.info(f"Mapped column {original_col} to {standard_col}")
                            break
                
                # Handle priority conflicts (e.g., prefer 'total' over 'subtotal' for the 'total' field)
                if 'subtotal' in used_standard_names and 'total' not in used_standard_names:
                    # Check if there's actually a 'total' column we can use
                    for original_col in df.columns:
                        original_col_lower = original_col.lower().strip()
                        if original_col_lower == 'total' and 'total' not in used_standard_names:
                            # Remove subtotal mapping and use total instead
                            subtotal_col = None
                            for k, v in column_mappings.items():
                                if v == 'subtotal':
                                    subtotal_col = k
                                    break
                            if subtotal_col:
                                del column_mappings[subtotal_col]
                                used_standard_names.remove('subtotal')
                            
                            column_mappings[original_col] = 'total'
                            used_standard_names.add('total')
                            logger.info(f"Prioritized 'total' column over subtotal: {original_col} -> total")
                            break

                logger.info(f"Final column mappings for {filename}: {column_mappings}")
                logger.info(f"Cleaning dataframe {filename}")
                # Clean the dataframe
                cleaned_df = self.cleaner.clean_dataframe(df, column_mappings)
                cleaned_dfs[filename] = cleaned_df
                logger.info(f"Successfully cleaned {filename}")

            # Generate basic statistics
            logger.info("Generating statistics")
            stats = self._generate_stats(cleaned_dfs)
            logger.info("Statistics generated successfully")

            return {
                "success": True,
                "message": "Files processed successfully",
                "errors": validation_errors,  # Include for transparency
                "stats": stats
            }

        except Exception as e:
            logger.error(f"Error during processing: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Error processing files: {str(e)}",
                "errors": validation_errors
            }

    def _generate_stats(self, cleaned_dfs: Dict[str, pd.DataFrame]) -> Dict:
        """Generate basic statistics from the cleaned dataframes."""
        stats = {
            "total_records": sum(len(df) for df in cleaned_dfs.values()),
            "files_processed": len(cleaned_dfs),
            "per_file_stats": {}
        }

        for filename, df in cleaned_dfs.items():
            file_stats = {
                "records": len(df),
                "columns": list(df.columns)
            }
            
            # Add specific stats based on file content
            if 'order_date' in df.columns:
                try:
                    min_date = df['order_date'].min()
                    max_date = df['order_date'].max()
                    file_stats["date_range"] = {
                        "start": min_date.strftime('%Y-%m-%d') if pd.notna(min_date) else "N/A",
                        "end": max_date.strftime('%Y-%m-%d') if pd.notna(max_date) else "N/A"
                    }
                except Exception as e:
                    logger.warning(f"Could not generate date range for {filename}: {str(e)}")
                    file_stats["date_range"] = {"start": "N/A", "end": "N/A"}
            
            if 'total' in df.columns:
                try:
                    total_revenue = df['total'].sum()
                    file_stats["total_revenue"] = float(total_revenue) if pd.notna(total_revenue) else 0.0
                except Exception as e:
                    logger.warning(f"Could not calculate total revenue for {filename}: {str(e)}")
                    file_stats["total_revenue"] = 0.0

            stats["per_file_stats"][filename] = file_stats

        return stats

    def process_sales_file(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process sales data file"""
        try:
            # Validate required columns
            required_columns = ['order_id', 'customer_id', 'product_id', 'price']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
            
            # Basic data cleaning
            df['price'] = pd.to_numeric(df['price'], errors='coerce')
            df = df.dropna(subset=['price'])
            
            # Store the processed data
            self.sales_data = df
            
            # Generate basic statistics
            stats = {
                "total_orders": len(df['order_id'].unique()),
                "total_customers": len(df['customer_id'].unique()),
                "total_revenue": df['price'].sum(),
                "avg_order_value": df['price'].mean()
            }
            
            return {
                "message": "Sales data processed successfully",
                "row_count": len(df),
                "statistics": stats
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    def process_products_file(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Process products data file"""
        try:
            # Validate required columns
            required_columns = ['product_id', 'name', 'category', 'price']
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
            
            # Basic data cleaning
            df['price'] = pd.to_numeric(df['price'], errors='coerce')
            df = df.dropna(subset=['price'])
            
            # Store the processed data
            self.products_data = df
            
            # Generate basic statistics
            stats = {
                "total_products": len(df),
                "categories": df['category'].nunique(),
                "avg_price": df['price'].mean(),
                "price_range": {
                    "min": df['price'].min(),
                    "max": df['price'].max()
                }
            }
            
            return {
                "message": "Products data processed successfully",
                "row_count": len(df),
                "statistics": stats
            }
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    def get_combined_insights(self) -> Dict[str, Any]:
        """Generate insights from combined sales and products data"""
        if self.sales_data is None or self.products_data is None:
            raise HTTPException(
                status_code=400,
                detail="Both sales and products data must be uploaded first"
            )
        
        try:
            # Merge sales and products data
            merged_data = pd.merge(
                self.sales_data,
                self.products_data[['product_id', 'name', 'category']],
                on='product_id'
            )
            
            # Generate insights
            category_performance = (
                merged_data
                .groupby('category')
                .agg({
                    'order_id': 'count',
                    'price_x': 'sum',
                    'customer_id': 'nunique'
                })
                .rename(columns={
                    'order_id': 'total_orders',
                    'price_x': 'total_revenue',
                    'customer_id': 'unique_customers'
                })
                .reset_index()
                .to_dict('records')
            )
            
            return {
                "message": "Combined insights generated",
                "category_performance": category_performance,
                "total_processed_orders": len(merged_data)
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# Create a global instance
file_processor = FileProcessor() 