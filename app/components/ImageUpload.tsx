"use client";

import { useState, useRef, useEffect } from 'react';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  currentImageUrl?: string | { fileId?: string; url: string; alt?: string };
  onImageUploaded: (imageData: string | { fileId: string; url: string; alt?: string }) => void;
  onFileSelected?: (file: File | null) => void; // New: for handling file selection without immediate upload
  label?: string;
  uploadOnSelect?: boolean; // New: whether to upload immediately or wait
}

export default function ImageUpload({ 
  currentImageUrl, 
  onImageUploaded, 
  onFileSelected,
  label = "Thumbnail Image",
  uploadOnSelect = false // Default to NOT uploading immediately
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Helper function to extract URL from currentImageUrl (could be string or object)
  const getUrlFromImageData = (imageData?: string | { fileId?: string; url: string; alt?: string }): string => {
    if (!imageData) return '';
    if (typeof imageData === 'string') return imageData;
    return imageData.url || '';
  };
  
  const [previewUrl, setPreviewUrl] = useState(getUrlFromImageData(currentImageUrl));
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update preview when currentImageUrl changes
  useEffect(() => {
    console.log('🔄 ImageUpload useEffect triggered');
    console.log('currentImageUrl changed to:', currentImageUrl);
    const extractedUrl = getUrlFromImageData(currentImageUrl);
    console.log('Extracted URL:', extractedUrl);
    setPreviewUrl(extractedUrl);
    console.log('Preview URL updated to:', extractedUrl);
  }, [currentImageUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('=== Image Selected ===');
    console.log('File:', file.name);
    console.log('Type:', file.type);
    console.log('Size:', file.size, 'bytes');
    console.log('Upload on select:', uploadOnSelect);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 4MB for Webflow)
    if (file.size > 4 * 1024 * 1024) {
      setError('Image size should be less than 4MB (Webflow limit)');
      return;
    }

    setError('');
    setSelectedFile(file);

    // Create local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('Local preview created');
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Notify parent component about file selection
    if (onFileSelected) {
      onFileSelected(file);
    }

    // If uploadOnSelect is true, upload immediately (old behavior)
    if (uploadOnSelect) {
      await uploadFile(file);
    }
  };

  // Separate upload function that can be called manually
  const uploadFile = async (file: File) => {
    setUploading(true);
    console.log('=== Starting Upload to Webflow ===');

    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('Sending request to /api/upload-image...');
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok || data.error) {
        const errorMsg = data.details || data.error || 'Upload failed';
        console.error('❌ Upload failed:', errorMsg);
        
        if (data.availableFields) {
          console.error('Available fields in asset:', data.availableFields);
          setError(`Upload Error: ${errorMsg}\n\nCheck server console for details.`);
        } else {
          setError(`Upload Error: ${errorMsg}`);
        }
        
        throw new Error(errorMsg);
      }

      // Validate response
      if (!data.fileId || !data.url) {
        throw new Error('Missing fileId or url in response');
      }

      console.log('✅ Upload successful!');
      onImageUploaded(data);
      setPreviewUrl(data.url); // Update to remote URL
      
      return data;
    } catch (err) {
      console.error('❌ Upload exception:', err);
      throw err;
    } finally {
      setUploading(false);
      console.log('=== Upload Finished ===');
    }
  };

  const handleRemoveImage = () => {
    console.log('🗑️ Removing image');
    setPreviewUrl('');
    setSelectedFile(null);
    onImageUploaded('');
    if (onFileSelected) {
      onFileSelected(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Expose upload function for parent to call
  // This will be used when uploadOnSelect is false
  useEffect(() => {
    // Store upload function reference for external access if needed
    if (!uploadOnSelect && selectedFile && (window as any).__pendingImageUpload !== uploadFile) {
      (window as any).__pendingImageUpload = () => uploadFile(selectedFile);
    }
  }, [selectedFile, uploadOnSelect]);

  return (
    <div className={styles.uploadContainer}>
      <label className={styles.label}>{label}:</label>
      
      {previewUrl ? (
        <div className={styles.previewContainer}>
          <img src={previewUrl} alt="Preview" className={styles.previewImage} />
          <div className={styles.previewOverlay}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={styles.changeButton}
              disabled={uploading}
            >
              🔄 Change
            </button>
            <button
              type="button"
              onClick={handleRemoveImage}
              className={styles.removeButton}
              disabled={uploading}
            >
              🗑️ Remove
            </button>
          </div>
        </div>
      ) : (
        <div 
          className={styles.dropZone}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={styles.dropZoneContent}>
            <span className={styles.uploadIcon}>📸</span>
            <p className={styles.dropZoneText}>
              {uploading ? 'Uploading...' : 'Click to upload image'}
            </p>
            <p className={styles.dropZoneHint}>
              PNG, JPG, GIF up to 4MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className={styles.fileInput}
        disabled={uploading}
      />

      {error && (
        <p className={styles.error}>{error}</p>
      )}

      {uploading && (
        <div className={styles.uploadingIndicator}>
          <span className={styles.spinner}>⏳</span>
          <span>Uploading image...</span>
        </div>
      )}
    </div>
  );
}

