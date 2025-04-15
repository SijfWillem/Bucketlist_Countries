# Travel Bucket List Map

An interactive web application that helps you visualize and plan your travel bucket list. Upload your travel plans and see them displayed on an interactive map with AI-generated itineraries.

## Features

- Interactive map visualization of travel destinations
- PDF upload and parsing of travel plans
- AI-generated detailed itineraries using MistralAI
- Export functionality for generated itineraries
- Responsive design for desktop and mobile

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MistralAI API key (for itinerary generation)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/SijfWillem/Bucketlist_Countries.git
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your MistralAI API key:
```
REACT_APP_MISTRAL_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Usage

1. Prepare your travel plans in a .md file with the following format:
   ```
   ### Trip Name (Trip duration)
   - Country 1
   - Country 2
   ```

2. Upload the PDF file through the application interface
3. View your trips on the interactive map
4. Click on a trip to see the AI-generated itinerary
5. Export the itinerary as a PDF

## Technologies Used

- React
- TypeScript
- Leaflet.js for map visualization
- Styled Components for styling
- MistralAI for itinerary generation
- jsPDF for PDF export

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
