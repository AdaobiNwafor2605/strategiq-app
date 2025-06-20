# FashionIQ - AI-Powered Analytics for Fashion Brands

Transform your Shopify data into actionable insights with AI-powered recommendations for customer segmentation, sales forecasting, and churn prevention.

## Features

- **Advanced Analytics**: Powerful segmentation, forecasting, and market basket analysis
- **AI-Powered Insights**: GPT-driven recommendations for business strategies
- **Customer Segmentation**: Automatically identify high-value customer segments
- **Churn Prevention**: Predict and prevent customer churn with ML-powered risk assessment

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI, Python 3.9+, pandas, scikit-learn
- **UI**: Lucide React icons, Recharts for data visualization

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Python 3.9 or higher
- pip

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FashionIQ
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

### Running the Application

1. **Start the backend server** (in one terminal)
   ```bash
   npm run backend
   ```
   This will start the FastAPI server on http://localhost:8000

2. **Start the frontend development server** (in another terminal)
   ```bash
   npm run dev
   ```
   This will start the Vite development server on http://localhost:5189

3. **Open your browser**
   Navigate to http://localhost:5189 to use the application

### API Endpoints

- `GET /` - Welcome message
- `POST /api/process-files` - Upload and process CSV/Excel files for analytics

### Usage

1. **Sign up/Login**: Create an account or log in with existing credentials
2. **Upload Data**: Upload your CSV files with customer and order data
3. **View Analytics**: Access comprehensive analytics dashboard
4. **Advanced Insights**: Get AI-powered recommendations (available in paid plans)

### Required Data Format

Your CSV files should contain the following columns:
- **Order ID** (or variations like "order number", "order_id")
- **Customer Email** (or "email", "customer_email")
- **Product Name** (or "item name", "product_name")
- **Order Date** (or "date", "created_at")
- **Quantity** (or "qty", "amount")
- **Unit Price** (or "price", "unit_price")
- **Total** (or "total_amount", "order_total")
- **Customer Location** (or "city", "address")

### Development Commands

```bash
# Start development frontend
npm run dev

# Start backend server
npm run backend

# Build for production
npm run build

# Run linter
npm run lint

# Type checking
npx tsc --noEmit
```

## Project Structure

```
FashionIQ/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── [other backend files]
├── src/
│   ├── components/          # React components
│   ├── contexts/           # React contexts
│   ├── types/              # TypeScript types
│   └── main.tsx            # React entry point
├── package.json
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here] 