import React, { useState, useEffect } from 'react';
import { X, Plus, Tag as TagIcon } from 'lucide-react';
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

const PLACEHOLDER_SUGGESTIONS = ['Tipster 1', 'Tipster 2'];

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

  useEffect(() => {
    if (user?.id) {
      fetchUserTags();
    }
  }, [user?.id]);

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
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-terminal-border hover:border-terminal-blue transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar Tag</span>
          </button>
        )}
      </div>

      {/* Tag Selector Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-terminal-dark-gray border border-terminal-border rounded shadow-lg p-3">
          {/* Create New Tag */}
          <div className="mb-3">
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
            
            {/* Placeholder Suggestions */}
            {allTags.length === 0 && !newTagName && (
              <div className="mt-2 text-xs opacity-40">
                Ex: {PLACEHOLDER_SUGGESTIONS.join(', ')}
              </div>
            )}
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
        </div>
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
