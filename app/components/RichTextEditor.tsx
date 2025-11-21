'use client';

import { useState, useRef, useEffect } from 'react';
import styles from '../page.module.css';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  height?: number;
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter content...",
  height = 400 
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSelection(sel.getRangeAt(0).cloneRange());
    }
  };

  const restoreSelection = () => {
    if (selection && editorRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(selection);
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    // Save current selection
    saveSelection();
    
    // Ensure editor has focus
    editorRef.current?.focus();
    
    // Restore selection and execute command
    setTimeout(() => {
      restoreSelection();
      document.execCommand(command, false, value);
      updateContent();
    }, 10);
  };

  const updateContent = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    updateContent();
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const uploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        if (imageUrl) {
          execCommand('insertImage', imageUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const ToolbarButton = ({ 
    onClick, 
    children, 
    title, 
    active = false 
  }: { 
    onClick: () => void; 
    children: React.ReactNode; 
    title: string; 
    active?: boolean; 
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`${styles.toolbarButton} ${active ? styles.toolbarButtonActive : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className={styles.richTextEditor}>
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={() => execCommand('bold')} title="Bold">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('italic')} title="Italic">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('underline')} title="Underline">
            <u>U</u>
          </ToolbarButton>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h1>')} title="Heading 1">
            H1
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h2>')} title="Heading 2">
            H2
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h3>')} title="Heading 3">
            H3
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h4>')} title="Heading 4">
            H4
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h5>')} title="Heading 5">
            H5
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<h6>')} title="Heading 6">
            H6
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('formatBlock', '<p>')} title="Paragraph">
            P
          </ToolbarButton>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
            • List
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="Numbered List">
            1. List
          </ToolbarButton>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={() => execCommand('justifyLeft')} title="Align Left">
            ←
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('justifyCenter')} title="Align Center">
            ↔
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('justifyRight')} title="Align Right">
            →
          </ToolbarButton>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={insertLink} title="Insert Link">
            🔗
          </ToolbarButton>
          <ToolbarButton onClick={insertImage} title="Insert Image URL">
            🖼️
          </ToolbarButton>
          <ToolbarButton onClick={uploadImage} title="Upload Image">
            📁
          </ToolbarButton>
        </div>

        <div className={styles.toolbarGroup}>
          <ToolbarButton onClick={() => execCommand('undo')} title="Undo">
            ↩️
          </ToolbarButton>
          <ToolbarButton onClick={() => execCommand('redo')} title="Redo">
            ↪️
          </ToolbarButton>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className={`${styles.editor} ${isFocused ? styles.editorFocused : ''}`}
        contentEditable
        onInput={updateContent}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        style={{ height: `${height}px` }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
} 