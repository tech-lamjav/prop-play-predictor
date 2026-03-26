import React, { useState, useEffect } from 'react';
import { X, Plus, Info } from 'lucide-react';
import { createClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
  onTagsUpdated?: () => void;
  /** When provided, skips internal fetch and uses this list as the tag source. */
  availableTags?: Tag[];
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
  '#84cc16', // lime
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#64748b', // slate
  '#d946ef', // fuchsia
];

export const TagSelector: React.FC<TagSelectorProps> = ({
  betId,
  selectedTags,
  onTagsChange,
  className = '',
  onTagsUpdated,
  availableTags: controlledTags,
}) => {
  const { user } = useAuth();
  const supabase = createClient();
  const [internalTags, setInternalTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [editingColorTagId, setEditingColorTagId] = useState<string | null>(null);

  // When controlledTags prop is provided by the parent, skip internal fetch.
  const allTags = controlledTags ?? internalTags;

  useEffect(() => {
    if (user?.id && !controlledTags) {
      fetchUserTags();
    }
  }, [user?.id, controlledTags]);

  const fetchUserTags = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (!error && data) {
      setInternalTags(data);
    }
  };

  const createTag = async () => {
    if (!user?.id || !newTagName.trim()) return;

    setIsCreating(true);

    const { data, error } = await supabase
      .from('tags')
      .insert({
        user_id: user.id,
        name: newTagName.trim(),
        color: selectedColor
      })
      .select()
      .single();

    if (!error && data) {
      setInternalTags(prev => [...prev, data]);
      setNewTagName('');
      handleTagToggle(data);
      onTagsUpdated?.();
    }

    setIsCreating(false);
  };

  const deleteTag = async (tagId: string) => {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (!error) {
      setInternalTags(prev => prev.filter(t => t.id !== tagId));
      onTagsChange(selectedTags.filter(t => t.id !== tagId));
      onTagsUpdated?.();
    }
  };

  const updateTagColor = async (tagId: string, newColor: string) => {
    const { data, error } = await supabase
      .from('tags')
      .update({ color: newColor })
      .eq('id', tagId)
      .select()
      .single();

    if (!error && data) {
      setInternalTags(prev => prev.map(t => t.id === tagId ? { ...t, color: newColor } : t));
      onTagsChange(selectedTags.map(t => t.id === tagId ? { ...t, color: newColor } : t));
      setEditingColorTagId(null);
      onTagsUpdated?.();
    }
  };

  const handleTagToggle = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);

    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      if (selectedTags.length >= 10) return;
      onTagsChange([...selectedTags, tag]);
    }
  };

  const availableTags = allTags.filter(
    tag => !selectedTags.some(st => st.id === tag.id)
  );

  return (
    <div className={`relative ${className}`}>
      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-1 items-center">
        {selectedTags.map(tag => (
          <Popover key={tag.id}>
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Alterar cor da tag ${tag.name}`}
                  className="hover:opacity-70 cursor-pointer"
                >
                  {tag.name}
                </button>
              </PopoverTrigger>
              <button
                type="button"
                onClick={() => handleTagToggle(tag)}
                className="hover:opacity-70"
                aria-label={`Remover tag ${tag.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="w-auto p-2 bg-terminal-dark-gray border-terminal-border text-terminal-text shadow-lg rounded"
            >
              <p className="text-xs opacity-50 uppercase mb-2">Cor da tag</p>
              <div className="flex flex-wrap gap-1.5 max-w-[168px]">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateTagColor(tag.id, color)}
                    aria-label={`Definir cor ${color} para ${tag.name}`}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      tag.color === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}

        {selectedTags.length < 10 && (
          <Popover
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) {
                setSelectedColor(TAG_COLORS[0]);
                setEditingColorTagId(null);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-terminal-border hover:border-terminal-blue transition-colors opacity-60 hover:opacity-100"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Tag</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="w-64 p-3 bg-terminal-dark-gray border-terminal-border text-terminal-text shadow-lg rounded"
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
                    onKeyDown={(e) => e.key === 'Enter' && createTag()}
                    placeholder="Nova tag..."
                    className="flex-1 bg-terminal-black border border-terminal-border text-terminal-text text-xs px-2 py-1 rounded"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={createTag}
                    disabled={!newTagName.trim() || isCreating}
                    className="px-2 py-1 bg-terminal-blue text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Cor ${color}`}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        selectedColor === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Available Tags */}
              {availableTags.length > 0 && (
                <div className="border-t border-terminal-border-subtle pt-2">
                  <div className="text-xs opacity-50 uppercase mb-2">Selecionar</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableTags.map(tag => (
                      <div key={tag.id} className="space-y-1">
                        <div className="flex items-center justify-between p-1 hover:bg-terminal-black rounded group">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingColorTagId(prev => prev === tag.id ? null : tag.id);
                              }}
                              aria-label={`Alterar cor da tag ${tag.name}`}
                              className={`w-3 h-3 rounded-full flex-shrink-0 border-2 transition-all ${
                                editingColorTagId === tag.id ? 'border-white scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: tag.color }}
                            />
                            <button
                              type="button"
                              onClick={() => handleTagToggle(tag)}
                              className="flex-1 text-left text-xs truncate"
                            >
                              {tag.name}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteTag(tag.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-terminal-red transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {editingColorTagId === tag.id && (
                          <div className="flex flex-wrap gap-1.5 pl-5 py-1">
                            {TAG_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateTagColor(tag.id, color)}
                                aria-label={`Definir cor ${color} para ${tag.name}`}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${
                                  tag.color === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        )}
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
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
