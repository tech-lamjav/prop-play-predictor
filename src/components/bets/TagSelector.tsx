import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Tag as TagIcon, Info } from 'lucide-react';
import { createClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  betId?: string;
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  className?: string;
}

const TAG_COLORS = [
  '#00d4ff', // terminal-blue
  '#00ff9d', // terminal-green
  '#ff6b6b', // terminal-red
  '#ffd93d', // yellow
  '#a78bfa', // purple
  '#fb923c', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
];

export const TagSelector: React.FC<TagSelectorProps> = ({
  betId,
  selectedTags,
  onTagsChange,
  className = ''
}) => {
  const { user } = useAuth();
  const supabase = createClient();
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchUserTags();
    }
  }, [user?.id]);

  const calculatePosition = () => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const spaceBelow = windowHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // Try to get real dropdown height, fallback to estimated or fixed distance
    const actualDropdownHeight = dropdownRef.current?.offsetHeight;
    const estimatedDropdownHeight = actualDropdownHeight || 200;
    const dropdownWidth = 256; // w-64 = 256px
    const minSpaceRequired = 50; // Minimum space needed
    const offset = 4; // mb-1 or mt-1 = 4px
    const fixedDistance = 8; // Fixed small distance when height not available
    
    let direction: 'up' | 'down' = 'down';
    let top = 0;
    
    // If there's not enough space below but there's space above, flip up
    if (spaceBelow < estimatedDropdownHeight + minSpaceRequired && spaceAbove > estimatedDropdownHeight + minSpaceRequired) {
      direction = 'up';
      // Use actual height if available, otherwise use fixed small distance
      const heightToUse = actualDropdownHeight || fixedDistance;
      top = buttonRect.top - heightToUse - offset;
    } else {
      direction = 'down';
      top = buttonRect.bottom + offset;
    }
    
    // Calculate left position aligned with button
    let left = buttonRect.left;
    
    // Adjust if dropdown would overflow on the right
    if (left + dropdownWidth > windowWidth) {
      left = windowWidth - dropdownWidth - 8; // 8px margin from edge
    }
    
    // Ensure dropdown doesn't overflow on the left
    if (left < 8) {
      left = 8;
    }
    
    setOpenDirection(direction);
    setDropdownPosition({ top, left });
  };

  // Calculate position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        calculatePosition();
      }, 0);
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Recalculate position after dropdown renders to use real height
  useEffect(() => {
    if (!isOpen || !dropdownPosition) return;

    // Small delay to ensure dropdown is rendered and ref is available
    const timeoutId = setTimeout(() => {
      if (dropdownRef.current && buttonRef.current) {
        // Recalculate position using real dropdown height
        // This is especially important when opening upward
        calculatePosition();
      }
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [isOpen]); // Recalculate when dropdown opens

  // Recalculate on scroll and resize while open
  useEffect(() => {
    if (!isOpen) return;

    const handleRecalculate = () => {
      calculatePosition();
    };

    window.addEventListener('scroll', handleRecalculate, true);
    window.addEventListener('resize', handleRecalculate);

    return () => {
      window.removeEventListener('scroll', handleRecalculate, true);
      window.removeEventListener('resize', handleRecalculate);
    };
  }, [isOpen]);

  const fetchUserTags = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setAllTags(data);
    }
  };

  const createTag = async () => {
    if (!user?.id || !newTagName.trim()) return;

    setIsCreating(true);
    
    // Auto-assign color from palette
    const colorIndex = allTags.length % TAG_COLORS.length;
    const color = TAG_COLORS[colorIndex];

    const { data, error } = await supabase
      .from('tags')
      .insert({
        user_id: user.id,
        name: newTagName.trim(),
        color: color
      })
      .select()
      .single();

    if (!error && data) {
      setAllTags([...allTags, data]);
      setNewTagName('');
      // Auto-select the newly created tag
      handleTagToggle(data);
    }

    setIsCreating(false);
  };

  const deleteTag = async (tagId: string) => {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (!error) {
      setAllTags(allTags.filter(t => t.id !== tagId));
      onTagsChange(selectedTags.filter(t => t.id !== tagId));
    }
  };

  const handleTagToggle = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      // Enforce 10 tag limit
      if (selectedTags.length >= 10) {
        return;
      }
      onTagsChange([...selectedTags, tag]);
    }
  };

  const availableTags = allTags.filter(
    tag => !selectedTags.some(st => st.id === tag.id)
  );

  return (
    <div className={`relative ${className}`}>
      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{ 
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              border: `1px solid ${tag.color}40`
            }}
          >
            {tag.name}
            <button
              onClick={() => handleTagToggle(tag)}
              className="hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        {selectedTags.length < 10 && (
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-terminal-border hover:border-terminal-blue transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar Tag</span>
          </button>
        )}
      </div>

      {/* Tag Selector Dropdown - Rendered via Portal */}
      {isOpen && dropdownPosition && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-50 w-64 bg-terminal-dark-gray border border-terminal-border rounded shadow-lg p-3"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          {/* Create New Tag */}
          <div className="mb-3">
            <div className="flex items-start gap-2 mb-2">
              <Info className="w-4 h-4 text-terminal-blue mt-0.5 flex-shrink-0" />
              <p className="text-xs text-terminal-text opacity-70">
                Crie tags para organizar suas apostas como preferir. Exemplos: Casa de Aposta, Banca, Tipster, Estratégia, etc.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createTag()}
                placeholder="Nova tag..."
                className="flex-1 bg-terminal-black border border-terminal-border text-terminal-text text-xs px-2 py-1 rounded"
                maxLength={50}
              />
              <button
                onClick={createTag}
                disabled={!newTagName.trim() || isCreating}
                className="px-2 py-1 bg-terminal-blue text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Available Tags */}
          {availableTags.length > 0 && (
            <div className="border-t border-terminal-border-subtle pt-2">
              <div className="text-xs opacity-50 uppercase mb-2">Selecionar</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableTags.map(tag => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-1 hover:bg-terminal-black rounded group"
                  >
                    <button
                      onClick={() => handleTagToggle(tag)}
                      className="flex-1 text-left flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-xs">{tag.name}</span>
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-terminal-red transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag Limit Warning */}
          {selectedTags.length >= 10 && (
            <div className="mt-2 text-xs text-terminal-red opacity-70">
              Máximo de 10 tags por aposta
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
