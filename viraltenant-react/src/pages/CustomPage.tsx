import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trash2, Type, Image as ImageIcon, Video,
  Minus, Save, Eye, EyeOff, Upload, Plus,
  AlignLeft, AlignCenter, AlignRight, Grid,
  Move, GripVertical
} from 'lucide-react';
import { customPageService, CustomPage as CustomPageType, PageBlock, BlockType } from '../services/customPage.service';
import { PageBanner } from '../components/PageBanner';
import { useAdmin } from '../hooks/useAdmin';
import { ImageCropper } from '../components/ImageCropper';
import { toast } from '../utils/toast-alert';

// Helper function to convert URLs in text to clickable links
const renderTextWithLinks = (text: string): React.ReactNode => {
  if (!text) return null;
  
  // Regex to match URLs (http, https, and www)
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const parts = text.split(urlRegex);
  
  if (parts.length === 1) return text;
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex since we're reusing it
      urlRegex.lastIndex = 0;
      const href = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-400 hover:text-primary-300 underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

const GRID_COLS = 12;
const ROW_HEIGHT = 80; // pixels per grid row

export function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAdmin } = useAdmin();
  const [page, setPage] = useState<CustomPageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [pageTitle, setPageTitle] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dragState, setDragState] = useState<{ blockId: string; startX: number; startY: number; startCol: number; startRow: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ blockId: string; startX: number; startY: number; startColSpan: number; startRowSpan: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate total rows needed
  const totalRows = useMemo(() => {
    if (blocks.length === 0) return 4;
    const maxRow = Math.max(...blocks.map(b => (b.gridRow || 1) + (b.gridRowSpan || 1) - 1));
    return Math.max(4, maxRow + 2);
  }, [blocks]);

  useEffect(() => {
    if (slug) loadPage();
  }, [slug]);

  // Check if a position is occupied
  const isPositionOccupied = useCallback((col: number, row: number, excludeBlockId?: string) => {
    return blocks.some(block => {
      if (block.id === excludeBlockId) return false;
      const bCol = block.gridColumn || 1;
      const bRow = block.gridRow || 1;
      const bColSpan = block.gridColSpan || 1;
      const bRowSpan = block.gridRowSpan || 1;
      return col >= bCol && col < bCol + bColSpan && row >= bRow && row < bRow + bRowSpan;
    });
  }, [blocks]);

  const updateBlock = useCallback((blockId: string, updates: Partial<PageBlock>) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...updates } : b));
    setHasChanges(true);
  }, []);

  // Keyboard navigation for selected block
  useEffect(() => {
    if (!editMode || !selectedBlockId) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveBlock(selectedBlockId, 'up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveBlock(selectedBlockId, 'down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveBlock(selectedBlockId, 'left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveBlock(selectedBlockId, 'right');
          break;
        case 'Delete':
        case 'Backspace':
          if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            deleteBlock(selectedBlockId);
          }
          break;
        case 'Escape':
          setSelectedBlockId(null);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, selectedBlockId, blocks]);

  // Drag handlers
  const handleDragStart = useCallback((blockId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setDragState({
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      startCol: block.gridColumn || 1,
      startRow: block.gridRow || 1
    });
    setSelectedBlockId(blockId);
  }, [blocks]);

  const handleResizeStart = useCallback((blockId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setResizeState({
      blockId,
      startX: e.clientX,
      startY: e.clientY,
      startColSpan: block.gridColSpan || 1,
      startRowSpan: block.gridRowSpan || 1
    });
  }, [blocks]);

  // Mouse move/up handlers for drag and resize
  useEffect(() => {
    if (!dragState && !resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragState) {
        const block = blocks.find(b => b.id === dragState.blockId);
        if (!block || !gridRef.current) return;
        
        const rect = gridRef.current.getBoundingClientRect();
        const cellWidth = (rect.width - 50) / GRID_COLS;
        const deltaCol = Math.round((e.clientX - dragState.startX) / cellWidth);
        const deltaRow = Math.round((e.clientY - dragState.startY) / ROW_HEIGHT);
        
        const newCol = Math.max(1, Math.min(GRID_COLS - (block.gridColSpan || 1) + 1, dragState.startCol + deltaCol));
        const newRow = Math.max(1, dragState.startRow + deltaRow);
        
        if (newCol !== block.gridColumn || newRow !== block.gridRow) {
          // Check collision
          let canMove = true;
          const colSpan = block.gridColSpan || 1;
          const rowSpan = block.gridRowSpan || 1;
          for (let c = newCol; c < newCol + colSpan && canMove; c++) {
            for (let r = newRow; r < newRow + rowSpan && canMove; r++) {
              if (isPositionOccupied(c, r, block.id)) canMove = false;
            }
          }
          if (canMove) {
            updateBlock(block.id, { gridColumn: newCol as any, gridRow: newRow });
          }
        }
      }
      
      if (resizeState) {
        const block = blocks.find(b => b.id === resizeState.blockId);
        if (!block || !gridRef.current) return;
        
        const rect = gridRef.current.getBoundingClientRect();
        const cellWidth = (rect.width - 50) / GRID_COLS;
        const deltaCol = Math.round((e.clientX - resizeState.startX) / cellWidth);
        const deltaRow = Math.round((e.clientY - resizeState.startY) / ROW_HEIGHT);
        
        const col = block.gridColumn || 1;
        const row = block.gridRow || 1;
        const newColSpan = Math.max(1, Math.min(GRID_COLS - col + 1, resizeState.startColSpan + deltaCol));
        const newRowSpan = Math.max(1, Math.min(12, resizeState.startRowSpan + deltaRow));
        
        if (newColSpan !== block.gridColSpan || newRowSpan !== block.gridRowSpan) {
          // Check collision for new size
          let canResize = true;
          const oldColSpan = block.gridColSpan || 1;
          const oldRowSpan = block.gridRowSpan || 1;
          for (let c = col; c < col + newColSpan && canResize; c++) {
            for (let r = row; r < row + newRowSpan && canResize; r++) {
              if (c >= col + oldColSpan || r >= row + oldRowSpan) {
                if (isPositionOccupied(c, r, block.id)) canResize = false;
              }
            }
          }
          if (canResize) {
            updateBlock(block.id, { 
              gridColSpan: newColSpan as 1|2|3|4|5|6|7|8|9|10|11|12, 
              gridRowSpan: newRowSpan as 1|2|3|4|5|6|7|8|9|10|11|12 
            });
          }
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, blocks, isPositionOccupied, updateBlock]);

  const loadPage = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const pageData = await customPageService.getCustomPageBySlug(slug);
      if (pageData) {
        setPage(pageData);
        // CloudFront domain for media URLs
        const cdnDomain = 'https://df5r2od45h0ol.cloudfront.net';
        
        // Migrate old blocks to new grid format and reconstruct media URLs
        const migratedBlocks = (pageData.blocks || []).map((block, index) => {
          const migrated = {
            ...block,
            gridColumn: block.gridColumn || 1,
            gridRow: block.gridRow || (index + 1),
            gridColSpan: block.gridColSpan || block.gridWidth || 12,
            gridRowSpan: block.gridRowSpan || 2
          };
          
          // Reconstruct image URL from key if URL is missing or is a blob or uses wrong CDN
          if (block.imageKey && (!block.imageUrl || block.imageUrl.startsWith('blob:') || block.imageUrl.includes('d1qcmn2bm2xjme'))) {
            // Ensure key has tenants/ prefix for CloudFront routing
            const normalizedKey = block.imageKey.startsWith('tenants/') ? block.imageKey : `tenants/${block.imageKey}`;
            migrated.imageUrl = `${cdnDomain}/${normalizedKey}`;
            migrated.imageKey = normalizedKey;
          }
          
          // Reconstruct video URL from key if URL is missing or is a blob or uses wrong CDN
          if (block.videoKey && (!block.videoUrl || block.videoUrl.startsWith('blob:') || block.videoUrl.includes('d1qcmn2bm2xjme'))) {
            // Ensure key has tenants/ prefix for CloudFront routing
            const normalizedKey = block.videoKey.startsWith('tenants/') ? block.videoKey : `tenants/${block.videoKey}`;
            migrated.videoUrl = `${cdnDomain}/${normalizedKey}`;
            migrated.videoKey = normalizedKey;
          }
          
          return migrated;
        });
        setBlocks(migratedBlocks);
        setPageTitle(pageData.title);
      }
    } catch (error) {
      console.error('Failed to load custom page:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    try {
      await customPageService.updateCustomPage(page.pageId, { title: pageTitle, blocks });
      setHasChanges(false);
      setPage(prev => prev ? { ...prev, title: pageTitle, blocks } : null);
      toast.success('Seite erfolgreich gespeichert!');
    } catch (error) {
      console.error('Failed to save page:', error);
      toast.error('Fehler beim Speichern der Seite');
    } finally {
      setSaving(false);
    }
  };

  // Find next available position
  const findNextPosition = (colSpan: number = 4, rowSpan: number = 2): { col: number; row: number } => {
    for (let row = 1; row <= totalRows + 5; row++) {
      for (let col = 1; col <= GRID_COLS - colSpan + 1; col++) {
        let fits = true;
        for (let c = col; c < col + colSpan && fits; c++) {
          for (let r = row; r < row + rowSpan && fits; r++) {
            if (isPositionOccupied(c, r)) fits = false;
          }
        }
        if (fits) return { col, row };
      }
    }
    return { col: 1, row: totalRows + 1 };
  };

  const addBlock = (type: BlockType) => {
    const defaultSizes: Record<string, { colSpan: number; rowSpan: number }> = {
      heading: { colSpan: 12, rowSpan: 1 },
      text: { colSpan: 6, rowSpan: 2 },
      image: { colSpan: 6, rowSpan: 3 },
      video: { colSpan: 8, rowSpan: 4 },
      divider: { colSpan: 12, rowSpan: 1 },
      spacer: { colSpan: 12, rowSpan: 1 }
    };
    const size = defaultSizes[type] || { colSpan: 4, rowSpan: 2 };
    const pos = findNextPosition(size.colSpan, size.rowSpan);
    const newBlock = customPageService.createGridBlock(type, pos.col, pos.row, size.colSpan, size.rowSpan);
    setBlocks([...blocks, newBlock]);
    setHasChanges(true);
    setAddMenuOpen(false);
    setSelectedBlockId(newBlock.id);
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    setHasChanges(true);
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const col = block.gridColumn || 1;
    const row = block.gridRow || 1;
    const colSpan = block.gridColSpan || 1;
    const rowSpan = block.gridRowSpan || 1;
    
    let newCol = col, newRow = row;
    if (direction === 'left' && col > 1) newCol = col - 1;
    if (direction === 'right' && col + colSpan <= GRID_COLS) newCol = col + 1;
    if (direction === 'up' && row > 1) newRow = row - 1;
    if (direction === 'down') newRow = row + 1;
    
    // Check collision
    let canMove = true;
    for (let c = newCol; c < newCol + colSpan && canMove; c++) {
      for (let r = newRow; r < newRow + rowSpan && canMove; r++) {
        if (isPositionOccupied(c, r, blockId)) canMove = false;
      }
    }
    
    if (canMove) {
      updateBlock(blockId, { gridColumn: newCol as any, gridRow: newRow });
    }
  };

  const handleImageSelect = (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBlockId(blockId);
    const reader = new FileReader();
    reader.onloadend = () => setCropperImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadUrl, key, publicUrl } = await customPageService.generateUploadUrl(file.name, file.type);
      await customPageService.uploadToS3(uploadUrl, file);
      updateBlock(blockId, { videoKey: key, videoUrl: publicUrl });
      toast.success('Video hochgeladen!');
    } catch (error) {
      console.error('Failed to upload video:', error);
      toast.error('Fehler beim Hochladen');
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!uploadingBlockId) return;
    try {
      const file = new File([croppedBlob], 'image.png', { type: 'image/png' });
      const { uploadUrl, key, publicUrl } = await customPageService.generateUploadUrl('image.png', 'image/png');
      await customPageService.uploadToS3(uploadUrl, file);
      updateBlock(uploadingBlockId, { imageKey: key, imageUrl: publicUrl });
      toast.success('Bild hochgeladen!');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setCropperImage(null);
      setUploadingBlockId(null);
    }
  };

  const renderBlockContent = (block: PageBlock) => {
    // Reconstruct URL from key if needed (for view mode)
    const cdnDomain = 'https://df5r2od45h0ol.cloudfront.net';
    const getImageUrl = () => {
      if (block.imageUrl && !block.imageUrl.startsWith('blob:') && !block.imageUrl.includes('d1qcmn2bm2xjme')) {
        return block.imageUrl;
      }
      if (block.imageKey) {
        // Ensure key has tenants/ prefix for CloudFront routing
        const normalizedKey = block.imageKey.startsWith('tenants/') ? block.imageKey : `tenants/${block.imageKey}`;
        return `${cdnDomain}/${normalizedKey}`;
      }
      return null;
    };
    const getVideoUrl = () => {
      if (block.videoUrl && !block.videoUrl.startsWith('blob:') && !block.videoUrl.includes('d1qcmn2bm2xjme')) {
        return block.videoUrl;
      }
      if (block.videoKey) {
        // Ensure key has tenants/ prefix for CloudFront routing
        const normalizedKey = block.videoKey.startsWith('tenants/') ? block.videoKey : `tenants/${block.videoKey}`;
        return `${cdnDomain}/${normalizedKey}`;
      }
      return null;
    };

    switch (block.type) {
      case 'heading':
        const HeadingTag = block.level || 'h2';
        const headingClasses: Record<string, string> = {
          h1: 'text-3xl md:text-4xl font-bold',
          h2: 'text-2xl md:text-3xl font-bold',
          h3: 'text-xl md:text-2xl font-semibold',
          h4: 'text-lg md:text-xl font-semibold'
        };
        return <HeadingTag className={`${headingClasses[HeadingTag]} ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : ''}`}>{block.content}</HeadingTag>;
      
      case 'text':
        return <p className={`text-dark-300 whitespace-pre-wrap ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : ''}`}>{renderTextWithLinks(block.content || '')}</p>;
      
      case 'image':
        const imageUrl = getImageUrl();
        if (!imageUrl) return <div className="h-full bg-dark-700 rounded flex items-center justify-center border-2 border-dashed border-dark-500"><ImageIcon size={32} className="text-dark-400" /></div>;
        return <img src={imageUrl} alt={block.alt || 'Bild'} className="w-full h-full object-cover rounded" />;
      
      case 'video':
        const videoUrl = getVideoUrl();
        if (!videoUrl) return <div className="h-full bg-dark-700 rounded flex items-center justify-center border-2 border-dashed border-dark-500"><Video size={32} className="text-dark-400" /></div>;
        return <video src={videoUrl} controls className="w-full h-full object-cover rounded" />;
      
      case 'divider':
        return <hr className="border-dark-600 w-full my-auto" />;
      
      case 'spacer':
        return null;
      
      default:
        return null;
    }
  };

  const renderBlockEditor = (block: PageBlock) => {
    const isSelected = selectedBlockId === block.id;
    const isDragging = dragState?.blockId === block.id;
    const isResizing = resizeState?.blockId === block.id;
    
    return (
      <div
        key={block.id}
        onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); }}
        className={`relative rounded-lg transition-all cursor-pointer
          ${isSelected ? 'ring-2 ring-primary-500' : 'ring-1 ring-dark-600 hover:ring-dark-500'}
          ${isDragging || isResizing ? 'opacity-80' : ''}`}
        style={{
          gridColumn: `${block.gridColumn || 1} / span ${block.gridColSpan || 1}`,
          gridRow: `${block.gridRow || 1} / span ${block.gridRowSpan || 1}`,
          zIndex: isSelected ? 50 : 10,
        }}
      >
        <div className="w-full h-full bg-dark-800 p-2 flex flex-col rounded-lg overflow-hidden">
          {/* Block Type Label + Controls */}
          <div className="text-[10px] text-dark-500 mb-1 flex items-center gap-2 flex-shrink-0">
            <span className="font-medium">{block.type.toUpperCase()}</span>
            
            {/* Heading Level Buttons - only for heading type */}
            {block.type === 'heading' && (
              <div className="flex gap-0.5">
                {(['h1', 'h2', 'h3', 'h4'] as const).map(level => (
                  <button key={level} onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { level }); }}
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${block.level === level ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-dark-300'}`}>
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            
            {/* Align Buttons - for heading and text */}
            {(block.type === 'heading' || block.type === 'text') && (
              <div className="flex gap-0.5">
                {(['left', 'center', 'right'] as const).map(align => (
                  <button key={align} onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { align }); }}
                    className={`p-0.5 rounded ${block.align === align ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-dark-300'}`}>
                    {align === 'left' && <AlignLeft size={10} />}
                    {align === 'center' && <AlignCenter size={10} />}
                    {align === 'right' && <AlignRight size={10} />}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex-1" />
            <span className="bg-dark-700 px-1.5 py-0.5 rounded">{block.gridColSpan}×{block.gridRowSpan}</span>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {renderBlockEditorContent(block)}
          </div>
        </div>

        {/* Selection Controls */}
        {isSelected && (
          <>
            {/* Delete Button - Top Right */}
            <button onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
              className="absolute p-1.5 bg-red-600 rounded-full hover:bg-red-700 shadow-lg border border-red-500"
              style={{ zIndex: 100, top: '-12px', right: '-12px' }}>
              <Trash2 size={14} className="text-white" />
            </button>
            
            {/* Drag Handle - Top Left */}
            <div 
              onMouseDown={(e) => handleDragStart(block.id, e)}
              className="absolute flex items-center gap-1 px-2 py-1 bg-primary-600 rounded shadow-lg cursor-move border border-primary-400 hover:bg-primary-500"
              style={{ zIndex: 100, top: '-12px', left: '-12px' }}
              title="Ziehen zum Verschieben (oder Pfeiltasten)"
            >
              <GripVertical size={14} className="text-white" />
              <Move size={12} className="text-white" />
            </div>

            {/* Resize Handle - Bottom Right Corner */}
            <div 
              onMouseDown={(e) => handleResizeStart(block.id, e)}
              className="absolute w-6 h-6 bg-green-600 rounded-tl-lg shadow-lg cursor-se-resize border-l border-t border-green-400 hover:bg-green-500 flex items-center justify-center"
              style={{ zIndex: 100, bottom: '0px', right: '0px' }}
              title="Ziehen zum Vergrößern/Verkleinern"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-white">
                <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderBlockEditorContent = (block: PageBlock) => {
    // Reconstruct URL from key if needed (for edit mode)
    const cdnDomain = 'https://df5r2od45h0ol.cloudfront.net';
    const getImageUrl = () => {
      if (block.imageUrl && !block.imageUrl.startsWith('blob:') && !block.imageUrl.includes('d1qcmn2bm2xjme')) {
        return block.imageUrl;
      }
      if (block.imageKey) {
        // Ensure key has tenants/ prefix for CloudFront routing
        const normalizedKey = block.imageKey.startsWith('tenants/') ? block.imageKey : `tenants/${block.imageKey}`;
        return `${cdnDomain}/${normalizedKey}`;
      }
      return null;
    };
    const getVideoUrl = () => {
      if (block.videoUrl && !block.videoUrl.startsWith('blob:') && !block.videoUrl.includes('d1qcmn2bm2xjme')) {
        return block.videoUrl;
      }
      if (block.videoKey) {
        // Ensure key has tenants/ prefix for CloudFront routing
        const normalizedKey = block.videoKey.startsWith('tenants/') ? block.videoKey : `tenants/${block.videoKey}`;
        return `${cdnDomain}/${normalizedKey}`;
      }
      return null;
    };

    switch (block.type) {
      case 'heading':
        const headingStyles: Record<string, string> = {
          h1: 'text-3xl font-bold',
          h2: 'text-2xl font-bold',
          h3: 'text-xl font-semibold',
          h4: 'text-lg font-semibold'
        };
        const currentLevel = block.level || 'h2';
        return (
          <div className="h-full flex flex-col">
            <div className={`flex-1 flex items-center ${block.align === 'center' ? 'justify-center' : block.align === 'right' ? 'justify-end' : ''}`}>
              <input type="text" value={block.content} onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                className={`w-full bg-transparent border-none outline-none ${headingStyles[currentLevel]} ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : ''}`} 
                placeholder="Überschrift..." />
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="h-full flex flex-col">
            <textarea value={block.content} onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              className={`flex-1 w-full bg-dark-900 rounded p-2 border border-dark-700 focus:border-primary-500 outline-none resize-none text-sm ${block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : ''}`}
              placeholder="Text eingeben..." />
          </div>
        );

      case 'image':
        const editorImageUrl = getImageUrl();
        return editorImageUrl ? (
          <div className="relative h-full">
            <img src={editorImageUrl} alt={block.alt} className="w-full h-full object-cover rounded" />
            <button onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { imageUrl: undefined, imageKey: undefined }); }}
              className="absolute top-1 right-1 p-1 bg-red-600/80 rounded hover:bg-red-700">
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <label className="h-full flex flex-col items-center justify-center border-2 border-dashed border-dark-600 rounded hover:border-primary-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input type="file" accept="image/*" onChange={(e) => handleImageSelect(block.id, e)} className="hidden" />
            <Upload size={20} className="mb-1 text-dark-400" />
            <span className="text-xs text-dark-400">Bild hochladen</span>
          </label>
        );

      case 'video':
        const editorVideoUrl = getVideoUrl();
        return editorVideoUrl ? (
          <div className="relative h-full">
            <video src={editorVideoUrl} controls className="w-full h-full object-cover rounded" />
            <button onClick={(e) => { e.stopPropagation(); updateBlock(block.id, { videoUrl: undefined, videoKey: undefined }); }}
              className="absolute top-1 right-1 p-1 bg-red-600/80 rounded hover:bg-red-700">
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <label className="h-full flex flex-col items-center justify-center border-2 border-dashed border-dark-600 rounded hover:border-primary-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input type="file" accept="video/*" onChange={(e) => handleVideoSelect(block.id, e)} className="hidden" />
            <Video size={20} className="mb-1 text-dark-400" />
            <span className="text-xs text-dark-400">Video hochladen</span>
          </label>
        );

      case 'divider':
        return <div className="h-full flex items-center"><hr className="w-full border-dark-600" /></div>;

      case 'spacer':
        return <div className="h-full flex items-center justify-center text-dark-500 text-xs">Abstand</div>;

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" /></div>;
  }

  if (!page) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold mb-2">Seite nicht gefunden</h1><p className="text-dark-400">Diese Seite existiert nicht.</p></div></div>;
  }

  return (
    <div className="min-h-screen" onClick={() => setSelectedBlockId(null)}>
      <PageBanner pageId={`custom-${slug}`}>
        <div>
          {editMode ? (
            <input type="text" value={pageTitle} onChange={(e) => { setPageTitle(e.target.value); setHasChanges(true); }}
              className="text-4xl md:text-5xl font-bold bg-transparent border-b-2 border-primary-500 outline-none w-full" placeholder="Seitentitel..." />
          ) : (
            <h1 className="text-4xl md:text-5xl font-bold"><span className="glow-text">{page.title}</span></h1>
          )}
        </div>
      </PageBanner>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editMode && (
                <div className="relative">
                  <button onClick={() => setAddMenuOpen(!addMenuOpen)} className="btn-secondary flex items-center gap-2">
                    <Plus size={18} /> Element hinzufügen
                  </button>
                  {addMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-dark-800 rounded-lg shadow-xl border border-dark-700 p-2 z-30 min-w-[160px]">
                      <button onClick={() => addBlock('heading')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-sm"><Type size={16} /> Überschrift</button>
                      <button onClick={() => addBlock('text')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-sm"><Type size={14} /> Text</button>
                      <button onClick={() => addBlock('image')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-sm"><ImageIcon size={16} /> Bild</button>
                      <button onClick={() => addBlock('video')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-sm"><Video size={16} /> Video</button>
                      <button onClick={() => addBlock('divider')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700 rounded text-sm"><Minus size={16} /> Trennlinie</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditMode(!editMode)} className={`btn-secondary flex items-center gap-2 ${editMode ? 'bg-primary-600' : ''}`}>
                {editMode ? <EyeOff size={18} /> : <Eye size={18} />}
                {editMode ? 'Vorschau' : 'Bearbeiten'}
              </button>
              {hasChanges && (
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {editMode ? (
            /* Edit Mode - 2D Grid */
            <div className="relative" style={{ overflow: 'visible' }}>
              {/* Grid Background */}
              <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: `calc(100% / ${GRID_COLS}) ${ROW_HEIGHT}px`,
                  height: totalRows * ROW_HEIGHT
                }}
              />
              
              {/* Grid Container */}
              <div 
                ref={gridRef}
                className="relative"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${totalRows}, ${ROW_HEIGHT}px)`,
                  gap: '8px',
                  minHeight: totalRows * ROW_HEIGHT,
                  overflow: 'visible',
                  paddingLeft: '50px',
                  paddingBottom: '50px',
                  marginLeft: '-50px'
                }}
              >
                {blocks.map(block => renderBlockEditor(block))}
              </div>

              {/* Empty State */}
              {blocks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-dark-500 text-center">
                    <Grid size={48} className="mx-auto mb-2 opacity-30" />
                    <p>Klicke "Element hinzufügen" um zu starten</p>
                  </div>
                </div>
              )}

              {/* Grid Info */}
              <div className="mt-4 text-xs text-dark-500 flex items-center gap-4">
                <span className="flex items-center gap-1"><Grid size={12} /> 12 Spalten × {totalRows} Zeilen</span>
                <span className="flex items-center gap-1"><Move size={12} /> Drag oder Pfeiltasten</span>
                <span>Ecke ziehen zum Skalieren</span>
              </div>
            </div>
          ) : (
            /* View Mode - CSS Grid */
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gridTemplateRows: `repeat(${totalRows}, ${ROW_HEIGHT}px)`,
                gap: '16px',
                minHeight: totalRows * ROW_HEIGHT
              }}
            >
              {blocks.map(block => (
                <div
                  key={block.id}
                  style={{
                    gridColumn: `${block.gridColumn || 1} / span ${block.gridColSpan || 1}`,
                    gridRow: `${block.gridRow || 1} / span ${block.gridRowSpan || 1}`,
                  }}
                >
                  {renderBlockContent(block)}
                </div>
              ))}
            </div>
          )}

          {blocks.length === 0 && !editMode && (
            <div className="text-center py-12 text-dark-400"><p>Diese Seite hat noch keinen Inhalt.</p></div>
          )}
        </motion.div>
      </div>

      {/* Image Cropper */}
      {cropperImage && (
        <ImageCropper image={cropperImage} onCropComplete={handleCropComplete}
          onCancel={() => { setCropperImage(null); setUploadingBlockId(null); }}
          aspectRatio={16 / 9} cropShape="rect" title="Bild zuschneiden"
          preserveFormat={true} optimizeForCrossposting={false} />
      )}
    </div>
  );
}

