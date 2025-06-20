import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Info, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProcessingResponse, ProcessingMetrics, DataUploadProps } from '../../types';

interface ValidationResult {
  fileName: string;
  isValid: boolean;
  foundColumns: string[];
  missingColumns: string[];
  allColumns: string[];
  error?: string;
}

// Core required columns for analytics - matching backend REQUIRED_COLUMNS
const REQUIRED_COLUMNS = [
  'order_id',
  'customer_email', 
  'product_name',
  'order_date',
  'quantity',
  'unit_price',
  'total'
];

// Optional columns that enhance analysis (will be shown if found, but not required)
const OPTIONAL_COLUMNS = [
  'customer_location',
  'customer_name',
  'customer_id',
  'financial_status',
  'fulfillment_status',
  'currency',
  'shipping',
  'taxes',
  'subtotal',
  'discount_amount',
  'phone',
  'country'
];

const COLUMN_FORMATS = {
  'order_id': { type: 'string', example: 'ORD-001', description: 'Unique identifier for each order' },
  'customer_email': { type: 'string', example: 'customer@example.com', description: 'Customer email address' },
  'product_name': { type: 'string', example: 'Blue T-Shirt', description: 'Name of the product purchased' },
  'order_date': { type: 'date', example: '2024-01-15', description: 'Date when order was placed (YYYY-MM-DD)' },
  'quantity': { type: 'number', example: '2', description: 'Number of items ordered' },
  'unit_price': { type: 'number', example: '29.99', description: 'Price per unit (without currency symbols)' },
  'total': { type: 'number', example: '59.98', description: 'Total order amount (without currency symbols)' },
  'customer_location': { type: 'string', example: 'New York', description: 'Customer city or location' },
  'currency': { type: 'string', example: 'USD', description: 'Currency code' },
  'shipping': { type: 'number', example: '5.99', description: 'Shipping cost' },
  'taxes': { type: 'number', example: '4.80', description: 'Tax amount' }
};

interface FileStatus {
  file: File;
  status: 'analyzing' | 'valid' | 'invalid' | 'processing' | 'processed' | 'error';
  foundColumns: string[];
  headers: string[];
  error?: string;
}

interface ProcessingStep {
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
}

export const DataUpload: React.FC<DataUploadProps> = ({ onProcessed }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { name: 'Data Validation', status: 'pending' },
    { name: 'Column Analysis', status: 'pending' },
    { name: 'Data Processing', status: 'pending' },
    { name: 'Analytics Generation', status: 'pending' }
  ]);
  const [backendMetrics, setBackendMetrics] = useState<{
    success: boolean;
    metrics?: Record<string, any>;
    warnings?: string[];
    error?: string;
  } | null>(null);

  const updateProcessingStep = (stepIndex: number, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(steps => 
      steps.map((step, index) => 
        index === stepIndex ? { ...step, status, message } : step
      )
    );
  };

  const validateFile = (file: File): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          let columns: string[] = [];
          
          if (file.name.endsWith('.csv')) {
            const lines = content.split('\n');
            if (lines.length > 0) {
              columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
            }
          }
          
          const foundColumns: string[] = [];
          const missingColumns: string[] = [];
          
          // Check required columns
          REQUIRED_COLUMNS.forEach(reqCol => {
            const found = columns.some(col => 
              col.toLowerCase().includes(reqCol.toLowerCase()) ||
              reqCol.toLowerCase().includes(col.toLowerCase())
            );
            if (found) {
              foundColumns.push(reqCol);
            } else {
              missingColumns.push(reqCol);
            }
          });

          resolve({
            fileName: file.name,
            isValid: missingColumns.length === 0,
            foundColumns,
            missingColumns,
            allColumns: columns
          });
        } catch (error) {
          resolve({
            fileName: file.name,
            isValid: false,
            foundColumns: [],
            missingColumns: REQUIRED_COLUMNS,
            allColumns: [],
            error: 'Failed to parse file'
          });
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    
    if (selectedFiles.length > 0) {
      const results = await Promise.all(selectedFiles.map(validateFile));
      setValidationResults(results);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    try {
      const response = await fetch('/api/process-files', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Handle successful upload
        console.log('Upload successful:', result);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const allFilesValid = validationResults.length > 0 && validationResults.every(result => result.isValid);
  const hasRequiredColumns = validationResults.length > 0 && 
    REQUIRED_COLUMNS.every(reqCol => 
      validationResults.some(result => result.foundColumns.includes(reqCol))
    );

  const handleProcessFiles = async () => {
    setIsProcessing(true);
    setProcessError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));

      const response = await axios.post<{
        success: boolean;
        metrics?: Record<string, any>;
        warnings?: string[];
        error?: string;
      }>('/api/process-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBackendMetrics(response.data);
      if (response.data.success && response.data.metrics) {
        const m = response.data.metrics;
        if (
          typeof m.total_revenue === 'number' &&
          typeof m.active_customers === 'number' &&
          typeof m.average_order_value === 'number' &&
          typeof m.churn_risk === 'number' &&
          Array.isArray(m.revenue_forecast) &&
          Array.isArray(m.customer_segments)
        ) {
          onProcessed(m as ProcessingMetrics);
        }
      }
    } catch (err) {
      setProcessError('Failed to process files. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Upload Your Data</h2>
            <Button 
              variant="outline" 
              onClick={() => setShowTemplate(!showTemplate)}
              className="text-sm"
            >
              {showTemplate ? 'Hide' : 'Show'} Data Template
            </Button>
          </div>
          
          {showTemplate && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Required Data Format</h3>
              
              {/* Visual Table Example */}
              <div className="mb-6">
                <h4 className="font-medium text-slate-700 mb-3">Example Data Table:</h4>
                <div className="overflow-x-auto bg-white rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {REQUIRED_COLUMNS.map(col => (
                          <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">ORD-001</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">john@example.com</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">Blue T-Shirt</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">2024-01-15</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">2</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">29.99</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">59.98</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">ORD-002</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">sarah@example.com</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">Red Dress</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">2024-01-16</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">1</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">89.50</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">89.50</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">ORD-003</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">mike@example.com</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">Black Jeans</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">2024-01-17</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">1</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">65.00</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">65.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">Required Columns:</h4>
                  <div className="space-y-2">
                    {REQUIRED_COLUMNS.map(col => (
                      <div key={col} className="text-sm">
                        <div className="font-medium">{col}</div>
                        <div className="text-gray-600">
                          {COLUMN_FORMATS[col]?.type} - {COLUMN_FORMATS[col]?.description}
                        </div>
                        <div className="text-blue-600">Example: {COLUMN_FORMATS[col]?.example}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-blue-700 mb-2">Optional Columns:</h4>
                  <div className="grid grid-cols-2 gap-1 text-sm text-gray-600">
                    {OPTIONAL_COLUMNS.map(col => (
                      <div key={col}>{col}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Tips:</strong> Your CSV column names will be automatically matched to these standard names. 
                  For example, "Order Number" or "OrderID" will match "order_id".
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* File Upload */}
      <Card>
        <CardContent className="p-6">
          <div className="border-2 border-dashed rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Upload your CSV files
            </h3>
            <p className="text-slate-600 mb-4">
              Drag and drop your files here, or click to browse
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-50 file:text-purple-700
                hover:file:bg-purple-100"
              multiple
            />
          </div>
        </CardContent>
      </Card>

      {/* Files List and Processing Status */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
            <div className="space-y-4 mb-6">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span>{file.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-600">
                      {validationResults.find(result => result.fileName === file.name)?.isValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Processing Steps */}
            {isProcessing && (
              <div className="mb-6 space-y-4">
                {processingSteps.map((step, index) => (
                  <div key={step.name} className="flex items-center space-x-3">
                    {step.status === 'pending' && (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                    )}
                    {step.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                    )}
                    {step.status === 'complete' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`flex-1 ${
                      step.status === 'complete' ? 'text-green-700' :
                      step.status === 'error' ? 'text-red-700' :
                      step.status === 'processing' ? 'text-purple-700' :
                      'text-slate-500'
                    }`}>
                      {step.name}
                    </span>
                    {step.message && (
                      <span className="text-sm text-red-600">{step.message}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {processError && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">
                <AlertCircle className="w-5 h-5 inline mr-2" />
                {processError}
              </div>
            )}

            <Button
              onClick={handleProcessFiles}
              disabled={isProcessing || files.length === 0}
              className="w-full"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Files...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  Process Files
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results Card */}
      {backendMetrics && (
        <Card className="mt-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Analysis Results</h3>
          </CardHeader>
          <CardContent>
            {backendMetrics.success ? (
              <div>
                <div className="mb-2">
                  {backendMetrics.metrics &&
                    Object.entries(backendMetrics.metrics).map(([key, value]) => (
                      <div key={key} className="text-slate-800">
                        <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                        {typeof value === 'object' ? JSON.stringify(value) : value}
                      </div>
                    ))}
                </div>
                {backendMetrics.warnings && backendMetrics.warnings.length > 0 && (
                  <div className="mt-2 text-yellow-700">
                    <div className="font-medium">Warnings:</div>
                    <ul className="list-disc ml-6">
                      {backendMetrics.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              typeof backendMetrics.error === 'string' && backendMetrics.error.trim() !== '' ? (
                <div className="text-red-700">{backendMetrics.error}</div>
              ) : null
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};