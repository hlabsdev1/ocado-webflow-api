'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';
import ImageUpload from './ImageUpload';

interface EditItemModalProps {
  item: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: any) => void;
}

export default function EditItemModal({ item, isOpen, onClose, onSave }: EditItemModalProps) {
  // Helper function to convert date format for HTML datetime-local input
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    
    // If it's already in YYYY-MM-DDTHH:mm format, return as is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateString)) {
      return dateString.slice(0, 16); // Returns YYYY-MM-DDTHH:mm
    }
    
    // Try to parse different date formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Convert to local time and format for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    return '';
  };

  // Helper function to get location name from ID
  const getLocationNameFromId = (locationId: string): string => {
    if (!locationId) return '';
    const location = locations.find((loc: any) => loc.id === locationId);
    return location?.fieldData?.name || location?.name || locationId;
  };

  // Get location code value - if it's an ID, we'll store it but display the name
  const getLocationCodeValue = () => {
    const locationCodeField = item?.fieldData?.['location-code'];
    if (Array.isArray(locationCodeField) && locationCodeField.length > 0) {
      return locationCodeField[0]; // Return the ID
    }
    return locationCodeField || '';
  };

  const [formData, setFormData] = useState({
    name: item?.fieldData?.name || item?.name || '',
    'requisition-id': item?.fieldData?.['requisition-id'] || '',
    'creation-date': formatDateForInput(item?.fieldData?.['creation-date'] || ''),
    'description-2': item?.fieldData?.['description-2'] || '',
    'job-family-id': item?.fieldData?.['job-family-id'] || '',
    'job-family-name': item?.fieldData?.['job-family-name'] || '',
    'job-schedule': item?.fieldData?.['job-schedule'] || '',
    'job-shift': item?.fieldData?.['job-shift'] || '',
    'location-description': item?.fieldData?.['location-description'] || '',
    'location-id': item?.fieldData?.['location-id'] || '',
    'location-name': item?.fieldData?.['location-name'] || '',
    'requisition-number': item?.fieldData?.['requisition-number'] || '',
    'short-description': item?.fieldData?.['short-description'] || '',
    state: item?.fieldData?.state || '',
    'location-code': getLocationCodeValue(), // Store the ID, but we'll display the name
    'location-as-text': item?.fieldData?.['location-as-text'] || 
                       item?.fieldData?.['location_as_text'] || 
                       item?.fieldData?.['location as text'] || 
                       item?.fieldData?.locationastext || '',
    thumbnail: item?.fieldData?.thumbnail || '',
    'ticket-link': item?.fieldData?.['ticket-link'] || '',
    isArchived: typeof item?.isArchived === 'boolean' ? item.isArchived : false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  useEffect(() => {
    // Fetch locations for location-code reference field
    async function fetchLocations() {
      try {
        const locationsResponse = await fetch('/api/locations');
        if (locationsResponse.ok) {
          const locationsData = await locationsResponse.json();
          setLocations(locationsData.items || []);
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    }
    fetchLocations();
  }, []);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    console.log(`📝 Field "${field}" updated with:`, value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };


  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Remove isArchived from fieldData
      const { isArchived, ...fieldDataWithoutIsArchived } = formData;
      
      // Convert location-code to array format if it's a reference field
      if (fieldDataWithoutIsArchived['location-code']) {
        // If it's already an array, keep it; otherwise convert to array
        if (!Array.isArray(fieldDataWithoutIsArchived['location-code'])) {
          fieldDataWithoutIsArchived['location-code'] = [fieldDataWithoutIsArchived['location-code']];
        }
      } else {
        // Remove location-code if it's empty
        delete fieldDataWithoutIsArchived['location-code'];
      }
      
      // Remove empty location-as-text field
      if (!fieldDataWithoutIsArchived['location-as-text']) {
        delete fieldDataWithoutIsArchived['location-as-text'];
      }
      
      // If there's a pending image file, upload it first
      if (pendingImageFile) {
        console.log('=== Uploading image before save ===');
        console.log('Pending file:', pendingImageFile.name);
        
        try {
          const imageFormData = new FormData();
          imageFormData.append('file', pendingImageFile);
          
          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: imageFormData,
          });
          
          if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.details || error.error || 'Failed to upload image');
          }
          
          const imageData = await uploadResponse.json();
          console.log('✅ Image uploaded:', imageData);
          
          // Update the thumbnail in fieldData with the uploaded image data
          fieldDataWithoutIsArchived.thumbnail = imageData;
        } catch (uploadError) {
          console.error('❌ Image upload failed:', uploadError);
          alert(`Failed to upload image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          setIsLoading(false);
          return; // Don't proceed with save if image upload fails
        }
      }
      
      // Clean up thumbnail field - remove if empty string, keep if object or omit entirely
      if (fieldDataWithoutIsArchived.thumbnail === '') {
        delete fieldDataWithoutIsArchived.thumbnail;
        console.log('Thumbnail is empty string - removing from payload');
      }
      
      console.log('=== Saving Item to CMS ===');
      console.log('Thumbnail data being sent:', fieldDataWithoutIsArchived.thumbnail);
      console.log('Thumbnail type:', typeof fieldDataWithoutIsArchived.thumbnail);
      console.log('Full fieldData:', JSON.stringify(fieldDataWithoutIsArchived, null, 2));
      
      const response = await fetch(`/api/collection/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: formData.isArchived,
          fieldData: fieldDataWithoutIsArchived
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to update item');
        console.error('Status:', response.status);
        console.error('Response:', errorText);
        
        // Try to parse error for better display
        try {
          const errorJson = JSON.parse(errorText);
          console.error('Parsed error:', errorJson);
          alert(`Failed to update item: ${errorJson.details || errorJson.error || errorText}`);
        } catch (e) {
          alert(`Failed to update item: ${errorText}`);
        }
        throw new Error(`Failed to update item: ${response.status}`);
      }

      const updatedItem = await response.json();
      onSave(updatedItem);
      onClose();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Edit Item</h3>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            padding: '0.75rem 1rem',
            background: 'rgba(110, 86, 207, 0.05)',
            borderLeft: '3px solid #6E56CF',
            borderRadius: '4px'
          }}>
            💡 <strong>Fields marked with</strong> <span style={{color: 'red'}}>*</span> <strong>are required.</strong>
          </p>
          
          <div className={styles.formGroup}>
            <label htmlFor="name">Title: <span style={{color: 'red'}}>*</span></label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={styles.formInput}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="requisition-id">Requisition ID:</label>
            <input
              type="text"
              id="requisition-id"
              value={formData['requisition-id']}
              onChange={(e) => handleInputChange('requisition-id', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="creation-date">Creation Date:</label>
            <input
              type="datetime-local"
              id="creation-date"
              value={formData['creation-date']}
              onChange={(e) => handleInputChange('creation-date', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description-2">Description 2:</label>
            <textarea
              id="description-2"
              value={formData['description-2']}
              onChange={(e) => handleInputChange('description-2', e.target.value)}
              className={styles.formTextarea}
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="job-family-id">Job Family ID:</label>
            <input
              type="text"
              id="job-family-id"
              value={formData['job-family-id']}
              onChange={(e) => handleInputChange('job-family-id', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="job-family-name">Job Family Name:</label>
            <input
              type="text"
              id="job-family-name"
              value={formData['job-family-name']}
              onChange={(e) => handleInputChange('job-family-name', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="job-schedule">Job Schedule:</label>
            <input
              type="text"
              id="job-schedule"
              value={formData['job-schedule']}
              onChange={(e) => handleInputChange('job-schedule', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="job-shift">Job Shift:</label>
            <input
              type="text"
              id="job-shift"
              value={formData['job-shift']}
              onChange={(e) => handleInputChange('job-shift', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="location-description">Location Description:</label>
            <input
              type="text"
              id="location-description"
              value={formData['location-description']}
              onChange={(e) => handleInputChange('location-description', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="location-id">Location ID:</label>
            <input
              type="text"
              id="location-id"
              value={formData['location-id']}
              onChange={(e) => handleInputChange('location-id', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="location-name">Location Name:</label>
            <input
              type="text"
              id="location-name"
              value={formData['location-name']}
              onChange={(e) => handleInputChange('location-name', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="requisition-number">Requisition Number:</label>
            <input
              type="text"
              id="requisition-number"
              value={formData['requisition-number']}
              onChange={(e) => handleInputChange('requisition-number', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="short-description">Short Description:</label>
            <textarea
              id="short-description"
              value={formData['short-description']}
              onChange={(e) => handleInputChange('short-description', e.target.value)}
              className={styles.formTextarea}
              rows={3}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="state">State:</label>
            <input
              type="text"
              id="state"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="location-code">Location Code (Reference):</label>
            <select
              id="location-code"
              value={formData['location-code']}
              onChange={(e) => handleInputChange('location-code', e.target.value)}
              className={styles.formInput}
              style={{ 
                cursor: 'pointer',
                fontWeight: '500',
                color: formData['location-code'] ? '#ffffff' : '#a0a3bd'
              }}
            >
              <option value="" style={{ background: '#211f2e', color: '#a0a3bd' }}>Select a location...</option>
              {locations.map((loc: any) => {
                // PRIORITY: Use fieldData.name as display text (this is where location codes are stored)
                // Example: fieldData.name = "OL_LOC_0020"
                // The value is still the ID (required for Webflow reference fields)
                const displayText = loc.fieldData?.name || loc.name || loc.slug || loc.id;
                
                return (
                  <option key={loc.id} value={loc.id} style={{ background: '#211f2e', color: '#ffffff' }}>
                    {displayText}
                  </option>
                );
              })}
            </select>
            {formData['location-code'] && (
              <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.5rem', 
                background: 'rgba(110, 86, 207, 0.1)', 
                borderRadius: '4px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                Selected: <strong style={{ color: '#6E56CF' }}>
                  {getLocationNameFromId(formData['location-code'])}
                </strong> (ID: {formData['location-code']})
              </div>
            )}
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
              Select a location by its code (e.g., "OL_LOC_0020") - the ID will be saved as reference
            </small>
          </div>

          <ImageUpload
            currentImageUrl={formData.thumbnail}
            onImageUploaded={(imageData) => handleInputChange('thumbnail', imageData as any)}
                onFileSelected={(file) => {
                  setPendingImageFile(file);
                }}
            uploadOnSelect={false}
            label="Thumbnail Image *"
          />

          <div className={styles.formGroup}>
            <label htmlFor="ticket-link">Ticket Link:</label>
            <input
              type="url"
              id="ticket-link"
              value={formData['ticket-link']}
              onChange={(e) => handleInputChange('ticket-link', e.target.value)}
              className={styles.formInput}
            />
          </div>

        </div>
        
        <div className={styles.modalFooter}>
          <div className={styles.modalFooterrow}>
            <button onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button> 
            <button 
              onClick={handleSave} 
              className={styles.saveButton}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 