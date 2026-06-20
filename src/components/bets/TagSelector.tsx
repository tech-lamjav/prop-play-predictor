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

// Paleta Direção A — cores saturadas/escuras pra contraste em fundo branco.
// Sem neons; tons que combinam com forest+amber sem brigar visualmente.
const TAG_COLORS = [
  '#0a3d2e', // forest (brand)
  '#1f5640', // forest soft
  '#92400e', // amber dark (brown)
  '#b8870f', // amber escuro
  '#7a3030', // wine
  '#9f1239', // rose escuro
  '#86198f', // fuchsia escuro
  '#5b4a8a', // purple muted
  '#3a4e8e', // navy
  '#0c4a6e', // sky escuro
  '#1c6f6f', // teal escuro
  '#065f46', // emerald escuro
  '#5a7838', // olive
  '#c97a1a', // burnt orange
  '#475569', // slate
  '#1a1d1a', // ink (preto)
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
              className="group inline-flex items-center gap-1.5 pl-1.5 pr-0.5 h-[22px] rounded-md border text-[10px] font-semibold transition-colors"
              style={{
                backgroundColor: `${tag.color}1A`, // ~10% opacity
                borderColor: `${tag.color}66`, // ~40% opacity
                color: '#1a1d1a', // ink — sempre escuro pra contraste
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: tag.color }}
              />
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Alterar cor da tag ${tag.name}`}
                  className="hover:opacity-80 cursor-pointer"
                >
                  {tag.name}
                </button>
              </PopoverTrigger>
              <button
                type="button"
                onClick={() => handleTagToggle(tag)}
                className="opacity-60 md:opacity-0 md:group-hover:opacity-60 hover:!opacity-100 hover:!text-status-danger transition-all -mr-0.5 inline-flex items-center justify-center w-5 h-5 md:w-auto md:h-auto md:px-0.5"
                aria-label={`Remover tag ${tag.name}`}
              >
                <X className="w-3 h-3 md:w-2.5 md:h-2.5" />
              </button>
            </span>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="theme-rebrand w-auto p-2 bg-white border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] rounded-md"
            >
              <p className="text-[10px] text-ink-2 uppercase tracking-[0.12em] font-semibold mb-2">Cor da tag</p>
              <div className="flex flex-wrap gap-1.5 max-w-[168px]">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateTagColor(tag.id, color)}
                    aria-label={`Definir cor ${color} para ${tag.name}`}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      tag.color === color ? 'border-ink scale-110' : 'border-transparent opacity-60 hover:opacity-100'
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
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border border-line text-ink-2 hover:border-forest hover:text-forest transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Tag</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="theme-rebrand w-64 p-3 bg-white border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] rounded-md"
            >
              {/* Create New Tag */}
              <div className="mb-3">
                <div className="flex items-start gap-2 mb-2">
                  <Info className="w-4 h-4 text-forest mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-ink-2">
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
                    className="flex-1 bg-canvas border border-line text-ink text-xs px-2 py-1 rounded-md focus:border-forest focus:bg-white outline-none"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={createTag}
                    disabled={!newTagName.trim() || isCreating}
                    className="px-2 py-1 bg-forest text-white text-xs rounded-md hover:bg-forest-soft disabled:opacity-50"
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
                        selectedColor === color ? 'border-ink scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Available Tags */}
              {availableTags.length > 0 && (
                <div className="border-t border-line pt-2">
                  <div className="text-[10px] text-ink-2 uppercase tracking-[0.12em] font-semibold mb-2">Selecionar</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableTags.map(tag => (
                      <div key={tag.id} className="space-y-1">
                        <div className="flex items-center justify-between p-1 hover:bg-ink-3/40 rounded-md group">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingColorTagId(prev => prev === tag.id ? null : tag.id);
                              }}
                              aria-label={`Alterar cor da tag ${tag.name}`}
                              className={`w-3 h-3 rounded-full flex-shrink-0 border-2 transition-all ${
                                editingColorTagId === tag.id ? 'border-ink scale-110' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: tag.color }}
                            />
                            <button
                              type="button"
                              onClick={() => handleTagToggle(tag)}
                              className="flex-1 text-left text-xs truncate text-ink"
                            >
                              {tag.name}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteTag(tag.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-ink-2 hover:text-status-danger transition-opacity"
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
                                  tag.color === color ? 'border-ink scale-110' : 'border-transparent opacity-60 hover:opacity-100'
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
                <div className="mt-2 text-xs text-status-danger">
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
