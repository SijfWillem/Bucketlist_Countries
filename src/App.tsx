import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, MapContainerProps } from 'react-leaflet';
import styled from 'styled-components';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getCountryCoordinates } from './utils/countryCoordinates';
import { Mistral } from '@mistralai/mistralai';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Trip {
  id: string;
  name: string;
  countries: string[];
  coordinates: [number, number][];
  duration: string;
}

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
`;

const UploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
  background: #f5f5f5;
`;

const UploadBox = styled.div`
  padding: 2rem;
  border: 2px dashed #ccc;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #666;
    background: #fff;
  }
`;

const MapWrapper = styled.div`
  flex: 1;
  height: 100%;
`;

const Sidebar = styled.div`
  width: 300px;
  background: white;
  padding: 20px;
  box-shadow: -2px 0 5px rgba(0,0,0,0.1);
  overflow-y: auto;
`;

const TripList = styled.div`
  width: 300px;
  background: white;
  padding: 20px;
  overflow-y: auto;
  height: 100%;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
`;

const TripItem = styled.div<{ isSelected: boolean }>`
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 8px;
  cursor: pointer;
  background: ${props => props.isSelected ? '#f0f0f0' : 'white'};
  border: 1px solid ${props => props.isSelected ? '#007bff' : '#ddd'};
  transition: all 0.3s ease;

  &:hover {
    background: #f5f5f5;
  }
`;

const TripTitle = styled.h3`
  margin: 0;
  color: #333;
  font-size: 1.1em;
`;

const TripDuration = styled.p`
  margin: 5px 0;
  color: #666;
  font-size: 0.9em;
`;

const TripCountries = styled.div<{ isExpanded: boolean }>`
  margin-top: 10px;
  max-height: ${props => props.isExpanded ? 'none' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
`;

const CountryList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const CountryItem = styled.li`
  padding: 5px 0;
  color: #444;
  font-size: 0.9em;
`;

const TripDetails = styled.div`
  margin-top: 20px;
`;

const ErrorMessage = styled.p`
  color: red;
  margin-top: 10px;
`;

const TripInfo = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  max-width: 300px;
  display: ${props => props.$visible ? 'block' : 'none'};
`;

const ItineraryContainer = styled.div`
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
`;

const ItineraryTitle = styled.h4`
  margin: 0 0 10px 0;
  color: #495057;
`;

const ItineraryContent = styled.div`
  color: #6c757d;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #007bff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.span`
  color: #6c757d;
`;

const ExportButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ExportIcon = styled.span`
  font-size: 18px;
`;

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<string | null>(null);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Initialize MistralAI client
  const mistralClient = new Mistral({
    apiKey: process.env.REACT_APP_MISTRAL_API_KEY || '',
    debugLogger: console
  });

  const parseTripsFromText = (text: string): Trip[] => {
    const trips: Trip[] = [];
    const lines = text.split('\n');
    let currentTrip: Partial<Trip> = {};
    let currentCountries: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and main title
      if (trimmedLine === '' || trimmedLine.startsWith('# ')) {
        continue;
      }
      
      // Check for trip title (starts with ##)
      if (trimmedLine.startsWith('## ')) {
        if (currentTrip.name && currentCountries.length > 0) {
          const coordinates = currentCountries.map(country => {
            const coords = getCountryCoordinates(country);
            if (coords[0] === 0 && coords[1] === 0) {
              console.warn(`Could not find coordinates for country: ${country}`);
            }
            return coords;
          });

          trips.push({
            id: currentTrip.name.toLowerCase().replace(/\s+/g, '-'),
            name: currentTrip.name,
            countries: [...currentCountries],
            coordinates,
            duration: currentTrip.duration || 'Unknown'
          });
        }
        
        // Extract trip name and duration from the title
        const tripTitle = trimmedLine.replace('## ', '').trim();
        const durationMatch = tripTitle.match(/\(([^)]+)\)/);
        const duration = durationMatch ? durationMatch[1] : 'Unknown';
        const name = tripTitle.replace(/\([^)]+\)/, '').trim();
        
        currentTrip = {
          name,
          duration
        };
        currentCountries = [];
      }
      // Check for country (starts with -)
      else if (trimmedLine.startsWith('-')) {
        const country = trimmedLine.replace('-', '').trim();
        currentCountries.push(country);
      }
    }

    // Add the last trip
    if (currentTrip.name && currentCountries.length > 0) {
      const coordinates = currentCountries.map(country => {
        const coords = getCountryCoordinates(country);
        if (coords[0] === 0 && coords[1] === 0) {
          console.warn(`Could not find coordinates for country: ${country}`);
        }
        return coords;
      });

      trips.push({
        id: currentTrip.name.toLowerCase().replace(/\s+/g, '-'),
        name: currentTrip.name,
        countries: currentCountries,
        coordinates,
        duration: currentTrip.duration || 'Unknown'
      });
    }

    if (trips.length === 0) {
      throw new Error('No valid trips found in the file. Please check the format.');
    }

    return trips;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();
      const trips = parseTripsFromText(text);
      setTrips(trips);
      setIsMapVisible(true);
    } catch (error) {
      console.error('Error processing file:', error);
      setError(error instanceof Error ? error.message : 'Error processing file. Please make sure the file is in the correct format.');
      setIsMapVisible(false);
    }
  };

  const generateItinerary = async (trip: Trip) => {
    setIsGeneratingItinerary(true);
    setItinerary(null);

    try {
      const prompt = `Create a detailed travel itinerary for a ${trip.duration} trip visiting the following countries: ${trip.countries.join(', ')}. 
      Include a day-by-day breakdown with suggested activities, transportation between countries, and any important travel tips. 
      Make it practical and realistic for the given duration.`;

      const response = await mistralClient.chat.complete({
        model: 'mistral-tiny',
        messages: [{ role: 'user', content: prompt }],
      });

      if (response?.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content;
        if (typeof content === 'string') {
          setItinerary(content);
        } else {
          setError('Invalid response format. Please try again.');
        }
      } else {
        setError('No itinerary was generated. Please try again.');
      }
    } catch (error) {
      console.error('Error generating itinerary:', error);
      setError('Failed to generate itinerary. Please try again.');
    } finally {
      setIsGeneratingItinerary(false);
    }
  };

  useEffect(() => {
    if (selectedTrip) {
      generateItinerary(selectedTrip);
    }
  }, [selectedTrip]);

  const exportToPDF = async () => {
    if (!selectedTrip || !itinerary) return;

    setIsExporting(true);
    try {
      // Create a new PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Set margins
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const maxWidth = pageWidth - (margin * 2);
      
      // Add header with trip name
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(selectedTrip.name, margin, margin + 10);
      
      // Add trip details in a box
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setDrawColor(200, 200, 200);
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, margin + 20, maxWidth, 20, 'FD');
      
      // Trip details text
      pdf.text(`Duration: ${selectedTrip.duration}`, margin + 5, margin + 30);
      pdf.text(`Countries: ${selectedTrip.countries.join(', ')}`, margin + 5, margin + 40);
      
      // Add itinerary section
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Itinerary', margin, margin + 70);
      
      // Add a line under the itinerary title
      pdf.setDrawColor(0, 0, 0);
      pdf.line(margin, margin + 72, pageWidth - margin, margin + 72);
      
      // Format and add the itinerary text
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      // Split the itinerary into paragraphs
      const paragraphs = itinerary.split('\n\n');
      let yPosition = margin + 85;
      
      for (const paragraph of paragraphs) {
        // Skip empty paragraphs
        if (!paragraph.trim()) continue;
        
        // Split text into lines that fit the page width
        const lines = pdf.splitTextToSize(paragraph, maxWidth);
        
        // Check if we need a new page
        if (yPosition + (lines.length * 5) > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Add the paragraph
        pdf.text(lines, margin, yPosition);
        yPosition += (lines.length * 5) + 5; // 5mm line height + 5mm paragraph spacing
      }

      // Add page numbers
      const pageCount = pdf.internal.pages.length;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
      }

      // Save the PDF
      pdf.save(`${selectedTrip.name.replace(/\s+/g, '_')}_itinerary.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setError('Failed to export itinerary. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isMapVisible) {
    return (
      <UploadContainer>
        <UploadBox>
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <h2>Upload Your Travel Bucket List</h2>
            <p>Click or drag and drop your Markdown file here</p>
            {error && <ErrorMessage>{error}</ErrorMessage>}
          </label>
        </UploadBox>
      </UploadContainer>
    );
  }

  return (
    <AppContainer>
      <MapWrapper ref={mapWrapperRef}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100vh', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {trips.map((trip) => (
            <React.Fragment key={trip.id}>
              {trip.coordinates.map((coord, index) => (
                <Marker
                  key={`${trip.id}-${index}`}
                  position={coord}
                  icon={L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background-color: ${selectedTrip?.id === trip.id ? '#007bff' : '#ff4444'}; 
                           width: 10px; 
                           height: 10px; 
                           border-radius: 50%; 
                           border: 2px solid white;
                           box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`
                  })}
                >
                  <Popup>
                    {trip.countries[index]}
                  </Popup>
                </Marker>
              ))}
              {selectedTrip?.id === trip.id && (
                <Polyline
                  positions={trip.coordinates}
                  color="#007bff"
                  weight={3}
                  opacity={0.7}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </MapWrapper>
      <TripList ref={sidebarRef}>
        {trips.map((trip) => (
          <TripItem
            key={trip.id}
            isSelected={selectedTrip?.id === trip.id}
            onClick={() => setSelectedTrip(trip)}
          >
            <TripTitle>{trip.name}</TripTitle>
            <TripDuration>{trip.duration}</TripDuration>
            <TripCountries isExpanded={selectedTrip?.id === trip.id}>
              <CountryList>
                {trip.countries.map((country) => (
                  <CountryItem key={country}>{country}</CountryItem>
                ))}
              </CountryList>
            </TripCountries>
            {selectedTrip?.id === trip.id && (
              <ItineraryContainer>
                <ItineraryTitle>Suggested Itinerary</ItineraryTitle>
                {isGeneratingItinerary ? (
                  <div>
                    <LoadingSpinner />
                    <LoadingText>Generating itinerary...</LoadingText>
                  </div>
                ) : (
                  <ItineraryContent>{itinerary}</ItineraryContent>
                )}
              </ItineraryContainer>
            )}
          </TripItem>
        ))}
      </TripList>
      {selectedTrip && (
        <ExportButton onClick={exportToPDF} disabled={isExporting}>
          <ExportIcon>📄</ExportIcon>
          {isExporting ? 'Exporting...' : 'Export Itinerary'}
        </ExportButton>
      )}
    </AppContainer>
  );
}

export default App; 