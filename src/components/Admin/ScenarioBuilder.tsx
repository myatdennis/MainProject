import { useMemo } from 'react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import SortableItem from '../SortableItem';

type ScenarioBuilderProps = {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
};

const newId = (prefix: string) => {
  try {
    return `${prefix}:${crypto.randomUUID()}`;
  } catch {
    return `${prefix}:${Math.random().toString(16).slice(2)}:${Date.now()}`;
  }
};

const coerceString = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const ensureScenario = (content: Record<string, any>) => {
  if (content?.scenario && typeof content.scenario === 'object' && Array.isArray(content.scenario.nodes)) {
    return content.scenario as Record<string, any>;
  }

  const legacyContext = coerceString(content?.scenarioText ?? content?.textContent ?? content?.content ?? '');
  const legacyOptions = Array.isArray(content?.options) ? content.options : [];

  const rootId = 'start';
  return {
    version: 1,
    title: '',
    context: legacyContext,
    situation: '',
    characters: [],
    startNodeId: rootId,
    nodes: [
      {
        id: rootId,
        title: 'In the moment',
        context: legacyContext,
        prompt: 'What do you do?',
        options: legacyOptions.map((o: any, index: number) => ({
          id: `opt:${index + 1}`,
          label: coerceString(o?.text),
          nextNodeId: null,
          coach: { whatHappened: coerceString(o?.feedback), howItMayHaveFelt: '', inclusiveLeaderConsideration: '' },
          impact: { empathy: 0, inclusion: 0, effectiveness: 0 },
        })),
      },
    ],
    requireReflection: false,
  };
};

const ScenarioBuilder = ({ value, onChange }: ScenarioBuilderProps) => {
  const scenario = useMemo(() => ensureScenario(value), [value]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
  );

  const nodes = Array.isArray(scenario.nodes) ? scenario.nodes : [];
  const nodeIds = nodes.map((node: any) => String(node.id));

  const updateScenario = (partial: Record<string, any>) => {
    onChange({
      ...value,
      scenario: {
        ...scenario,
        ...partial,
      },
    });
  };

  const updateNode = (nodeId: string, patch: Record<string, any>) => {
    const nextNodes = nodes.map((node: any) => (String(node.id) === nodeId ? { ...node, ...patch } : node));
    updateScenario({ nodes: nextNodes });
  };

  const deleteNode = (nodeId: string) => {
    const nextNodes = nodes.filter((node: any) => String(node.id) !== nodeId);
    const nextStart = String(scenario.startNodeId) === nodeId ? (nextNodes[0]?.id ?? 'start') : scenario.startNodeId;
    updateScenario({
      startNodeId: nextStart,
      nodes: nextNodes,
    });
  };

  const addNode = () => {
    const id = newId('node');
    const nextNodes = [
      ...nodes,
      {
        id,
        title: 'Decision',
        context: '',
        prompt: 'What do you do?',
        options: [
          {
            id: newId('opt'),
            label: '',
            nextNodeId: null,
            coach: { whatHappened: '', howItMayHaveFelt: '', inclusiveLeaderConsideration: '' },
            impact: { empathy: 0, inclusion: 0, effectiveness: 0 },
          },
        ],
      },
    ];
    updateScenario({
      startNodeId: scenario.startNodeId || id,
      nodes: nextNodes,
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = nodeIds.indexOf(String(active.id));
    const newIndex = nodeIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    updateScenario({ nodes: arrayMove(nodes, oldIndex, newIndex) });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
        <p className="text-sm font-semibold text-orange-900">Scenario Lesson (Immersive)</p>
        <p className="mt-1 text-xs text-orange-700">
          Build branching decisions with non-judgmental coaching and a reflection layer. Learners won’t see “correct” answers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Context setup</label>
          <textarea
            value={coerceString(scenario.context)}
            onChange={(e) => updateScenario({ context: e.target.value })}
            rows={4}
            placeholder="Short, immersive story that sets the scene..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Situation (decision point)</label>
          <textarea
            value={coerceString(scenario.situation)}
            onChange={(e) => updateScenario({ situation: e.target.value })}
            rows={4}
            placeholder="What tension or conflict brings us to a decision?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Characters</p>
            <p className="text-xs text-gray-600">Add names and roles to make the scenario feel human.</p>
          </div>
          <button
            type="button"
            onClick={() => updateScenario({ characters: [...(scenario.characters || []), { id: newId('char'), name: '', role: '', pronouns: '' }] })}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add character
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {(scenario.characters || []).map((c: any, index: number) => (
            <div key={c.id ?? index} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-4">
              <input
                value={coerceString(c.name)}
                onChange={(e) => {
                  const next = [...(scenario.characters || [])];
                  next[index] = { ...c, name: e.target.value };
                  updateScenario({ characters: next });
                }}
                placeholder="Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                value={coerceString(c.role)}
                onChange={(e) => {
                  const next = [...(scenario.characters || [])];
                  next[index] = { ...c, role: e.target.value };
                  updateScenario({ characters: next });
                }}
                placeholder="Role"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                value={coerceString(c.pronouns)}
                onChange={(e) => {
                  const next = [...(scenario.characters || [])];
                  next[index] = { ...c, pronouns: e.target.value };
                  updateScenario({ characters: next });
                }}
                placeholder="Pronouns (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (scenario.characters || []).filter((_: any, i: number) => i !== index);
                  updateScenario({ characters: next });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </div>
          ))}
          {(scenario.characters || []).length === 0 && (
            <p className="text-xs text-gray-500">No characters yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Decision nodes</p>
            <p className="text-xs text-gray-600">Drag nodes to reorder. Branch by selecting a “next node” per option.</p>
          </div>
          <button
            type="button"
            onClick={addNode}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> Add node
          </button>
        </div>

        <div className="mt-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={nodeIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {nodes.map((node: any) => (
                  <SortableItem key={String(node.id)} id={String(node.id)} className="block">
                    {({ setActivatorNodeRef, attributes, listeners }) => (
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <button
                              ref={setActivatorNodeRef}
                              {...attributes}
                              {...listeners}
                              type="button"
                              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                              aria-label="Reorder node"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Node {String(node.id) === String(scenario.startNodeId) ? '(Start)' : ''}
                              </p>
                              <input
                                value={coerceString(node.title)}
                                onChange={(e) => updateNode(String(node.id), { title: e.target.value })}
                                placeholder="Node title (learner won’t see this unless you add it)"
                                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteNode(String(node.id))}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Node context</label>
                            <textarea
                              value={coerceString(node.context)}
                              onChange={(e) => updateNode(String(node.id), { context: e.target.value })}
                              rows={3}
                              placeholder="Optional: extra context that appears above the decision."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Decision prompt</label>
                            <input
                              value={coerceString(node.prompt)}
                              onChange={(e) => updateNode(String(node.id), { prompt: e.target.value })}
                              placeholder="What do you do?"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Options</p>
                            <button
                              type="button"
                              onClick={() => {
                                const nextOptions = [
                                  ...(Array.isArray(node.options) ? node.options : []),
                                  {
                                    id: newId('opt'),
                                    label: '',
                                    nextNodeId: null,
                                    coach: { whatHappened: '', howItMayHaveFelt: '', inclusiveLeaderConsideration: '' },
                                    impact: { empathy: 0, inclusion: 0, effectiveness: 0 },
                                  },
                                ];
                                updateNode(String(node.id), { options: nextOptions });
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <Plus className="h-4 w-4" /> Add option
                            </button>
                          </div>

                          <div className="mt-3 space-y-3">
                            {(Array.isArray(node.options) ? node.options : []).map((opt: any, optIndex: number) => (
                              <div key={String(opt.id ?? optIndex)} className="rounded-lg border border-gray-200 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-900">Option {optIndex + 1}</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextOptions = (node.options || []).filter((_: any, i: number) => i !== optIndex);
                                      updateNode(String(node.id), { options: nextOptions });
                                    }}
                                    className="text-red-600 hover:text-red-800"
                                    aria-label="Remove option"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Label</label>
                                    <input
                                      value={coerceString(opt.label)}
                                      onChange={(e) => {
                                        const nextOptions = [...(node.options || [])];
                                        nextOptions[optIndex] = { ...opt, label: e.target.value };
                                        updateNode(String(node.id), { options: nextOptions });
                                      }}
                                      placeholder="What the learner chooses..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Next node</label>
                                    <select
                                      value={opt.nextNodeId ?? ''}
                                      onChange={(e) => {
                                        const nextOptions = [...(node.options || [])];
                                        nextOptions[optIndex] = { ...opt, nextNodeId: e.target.value ? e.target.value : null };
                                        updateNode(String(node.id), { options: nextOptions });
                                      }}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    >
                                      <option value="">End scenario</option>
                                      {nodes.map((n: any) => (
                                        <option key={String(n.id)} value={String(n.id)}>
                                          {coerceString(n.title) || String(n.id)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">What happened</label>
                                    <textarea
                                      value={coerceString(opt.coach?.whatHappened)}
                                      onChange={(e) => {
                                        const nextOptions = [...(node.options || [])];
                                        nextOptions[optIndex] = {
                                          ...opt,
                                          coach: { ...(opt.coach || {}), whatHappened: e.target.value },
                                        };
                                        updateNode(String(node.id), { options: nextOptions });
                                      }}
                                      rows={2}
                                      placeholder="Concrete consequence..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">How it may have felt</label>
                                    <textarea
                                      value={coerceString(opt.coach?.howItMayHaveFelt)}
                                      onChange={(e) => {
                                        const nextOptions = [...(node.options || [])];
                                        nextOptions[optIndex] = {
                                          ...opt,
                                          coach: { ...(opt.coach || {}), howItMayHaveFelt: e.target.value },
                                        };
                                        updateNode(String(node.id), { options: nextOptions });
                                      }}
                                      rows={2}
                                      placeholder="Perspective-taking..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">What to consider</label>
                                    <textarea
                                      value={coerceString(opt.coach?.inclusiveLeaderConsideration)}
                                      onChange={(e) => {
                                        const nextOptions = [...(node.options || [])];
                                        nextOptions[optIndex] = {
                                          ...opt,
                                          coach: { ...(opt.coach || {}), inclusiveLeaderConsideration: e.target.value },
                                        };
                                        updateNode(String(node.id), { options: nextOptions });
                                      }}
                                      rows={2}
                                      placeholder="Inclusive leadership lens..."
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                    />
                                  </div>
                                </div>

                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  {(['empathy', 'inclusion', 'effectiveness'] as const).map((k) => (
                                    <div key={k}>
                                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                        {k}
                                      </label>
                                      <select
                                        value={opt.impact?.[k] ?? 0}
                                        onChange={(e) => {
                                          const nextOptions = [...(node.options || [])];
                                          nextOptions[optIndex] = {
                                            ...opt,
                                            impact: { ...(opt.impact || {}), [k]: Number(e.target.value) },
                                          };
                                          updateNode(String(node.id), { options: nextOptions });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                      >
                                        <option value={-2}>Low</option>
                                        <option value={-1}>Mixed</option>
                                        <option value={0}>Neutral</option>
                                        <option value={1}>Supportive</option>
                                        <option value={2}>Strong</option>
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {nodes.length === 0 && (
            <p className="text-xs text-gray-500 mt-3">No nodes yet. Add your first decision node to begin.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioBuilder;

