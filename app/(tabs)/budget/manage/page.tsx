"use client";

import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import EditableText from "@/components/forms/EditableText";
import NoteEditor from "@/components/forms/NoteEditor";
import { useHorizonStore } from "@/components/store/HorizonStore";

type DragKind = "group" | "category";

export default function ManageCategoriesPage() {
  const {
    groups,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    addCategory,
    renameCategory,
    setCategoryNote,
    setCategoryHidden,
    setCategoryEmoji,
    setGroupEmoji,
    deleteCategory,
    moveCategory,
    reorderGroup,
    reorderCategory,
    markUndoable,
  } = useHorizonStore();
  const [drag, setDrag] = useState<{ kind: DragKind; id: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function startDrag(kind: DragKind, id: string) {
    return (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `${kind}:${id}`);
      setDrag({ kind, id });
    };
  }

  function dragOver(targetId: string) {
    return (e: DragEvent<HTMLElement>) => {
      if (!drag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(targetId);
    };
  }

  function endDrag() {
    setDrag(null);
    setDragOverId(null);
  }

  function dropOnGroup(targetGroupId: string) {
    return (e: DragEvent<HTMLElement>) => {
      if (!drag) return;
      e.preventDefault();
      if (drag.kind === "group") {
        const targetIndex = groups.findIndex((g) => g.id === targetGroupId);
        if (targetIndex >= 0 && drag.id !== targetGroupId) {
          reorderGroup(drag.id, targetIndex);
        }
      } else {
        // Dropping a category onto a group's outer card (not on one of
        // its rows) appends the category to the end of that group —
        // useful for moving a category to an empty group or past the
        // last row.
        const ownerGroup = groups.find((g) =>
          g.categories.some((c) => c.id === drag.id),
        );
        const destGroup = groups.find((g) => g.id === targetGroupId);
        if (!ownerGroup || !destGroup) {
          endDrag();
          return;
        }
        if (ownerGroup.id === targetGroupId) {
          endDrag();
          return;
        }
        reorderCategory(drag.id, destGroup.categories.length, targetGroupId);
      }
      endDrag();
    };
  }

  function dropOnCategory(targetGroupId: string, targetCategoryId: string) {
    return (e: DragEvent<HTMLElement>) => {
      if (!drag || drag.kind !== "category") return;
      e.preventDefault();
      const ownerGroup = groups.find((g) =>
        g.categories.some((c) => c.id === drag.id),
      );
      const destGroup = groups.find((g) => g.id === targetGroupId);
      if (!ownerGroup || !destGroup) {
        endDrag();
        return;
      }
      const targetIndex = destGroup.categories.findIndex(
        (c) => c.id === targetCategoryId,
      );
      if (targetIndex < 0 || drag.id === targetCategoryId) {
        endDrag();
        return;
      }
      if (ownerGroup.id === targetGroupId) {
        reorderCategory(drag.id, targetIndex);
      } else {
        reorderCategory(drag.id, targetIndex, targetGroupId);
      }
      endDrag();
    };
  }
  const [newCatNames, setNewCatNames] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string>("");

  // Lower-case sets for fast uniqueness checks. Categories are checked across
  // every group; groups are checked among themselves.
  const { allCategoryNames, allGroupNames } = useMemo(() => {
    const cats = new Set<string>();
    const grps = new Set<string>();
    for (const g of groups) {
      grps.add(g.name.toLowerCase());
      for (const c of g.categories) cats.add(c.name.toLowerCase());
    }
    return { allCategoryNames: cats, allGroupNames: grps };
  }, [groups]);

  function flashError(msg: string) {
    setError(msg);
    window.setTimeout(() => setError(""), 3000);
  }

  function submitNewCategory(groupId: string) {
    return (e: FormEvent) => {
      e.preventDefault();
      const name = (newCatNames[groupId] ?? "").trim();
      if (name === "") return;
      if (allCategoryNames.has(name.toLowerCase())) {
        flashError(`A category named "${name}" already exists.`);
        return;
      }
      addCategory(groupId, name);
      setNewCatNames((m) => ({ ...m, [groupId]: "" }));
    };
  }

  function submitNewGroup(e: FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (name === "") return;
    if (allGroupNames.has(name.toLowerCase())) {
      flashError(`A group named "${name}" already exists.`);
      return;
    }
    addGroup(name);
    setNewGroupName("");
  }

  function commitGroupRename(groupId: string, currentName: string) {
    return (next: string) => {
      const trimmed = next.trim();
      if (trimmed === "" || trimmed === currentName) return;
      const lower = trimmed.toLowerCase();
      if (lower !== currentName.toLowerCase() && allGroupNames.has(lower)) {
        flashError(`A group named "${trimmed}" already exists.`);
        return;
      }
      renameGroup(groupId, trimmed);
    };
  }

  function commitCategoryRename(categoryId: string, currentName: string) {
    return (next: string) => {
      const trimmed = next.trim();
      if (trimmed === "" || trimmed === currentName) return;
      const lower = trimmed.toLowerCase();
      if (lower !== currentName.toLowerCase() && allCategoryNames.has(lower)) {
        flashError(`A category named "${trimmed}" already exists.`);
        return;
      }
      renameCategory(categoryId, trimmed);
    };
  }

  return (
    <>
      <SubpageHeader title="Manage Categories" backHref="/budget" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        {error && (
          <div className="rounded-2xl bg-amber-900/30 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {groups.map((g, gi) => (
          <section
            key={g.id}
            className={`rounded-2xl bg-card p-4 transition-colors ${
              drag &&
              dragOverId === g.id &&
              // Highlight when:
              //   • dragging a group onto another group (reorder)
              //   • dragging a category over a DIFFERENT group's card
              //     (cross-group move to the end of that group)
              (drag.kind === "group" ||
                !g.categories.some((c) => c.id === drag.id))
                ? "ring-2 ring-accent/60"
                : ""
            }`}
            onDragOver={dragOver(g.id)}
            onDrop={dropOnGroup(g.id)}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Drag ${g.name}`}
                draggable
                onDragStart={startDrag("group", g.id)}
                onDragEnd={endDrag}
                className="grid h-8 w-6 place-items-center text-fg/40 cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={16} />
              </button>
              <input
                type="text"
                value={g.emoji ?? ""}
                onChange={(e) => setGroupEmoji(g.id, e.target.value)}
                maxLength={4}
                placeholder="·"
                aria-label={`Emoji for ${g.name}`}
                className="w-8 rounded-md bg-card-elevated px-1 py-0.5 text-center text-sm outline-none placeholder:text-fg/30"
              />
              <EditableText
                value={g.name}
                onCommit={commitGroupRename(g.id, g.name)}
                ariaLabel={`Rename group ${g.name}`}
                className="flex-1 text-lg font-bold"
              />
              <button
                type="button"
                onClick={() => moveGroup(g.id, -1)}
                disabled={gi === 0}
                aria-label={`Move ${g.name} up`}
                className="grid h-8 w-8 place-items-center text-fg/55 hover:text-fg disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveGroup(g.id, 1)}
                disabled={gi === groups.length - 1}
                aria-label={`Move ${g.name} down`}
                className="grid h-8 w-8 place-items-center text-fg/55 hover:text-fg disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete group "${g.name}"? This removes ${g.categories.length} ${g.categories.length === 1 ? "category" : "categories"} along with their assignments and targets.`,
                    )
                  ) {
                    markUndoable(`Group "${g.name}" deleted`);
                    deleteGroup(g.id);
                  }
                }}
                aria-label={`Delete group ${g.name}`}
                className="grid h-8 w-8 place-items-center text-rose-400/70 hover:text-rose-400"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <ul className="mt-2 divide-y divide-fg/5">
              {g.categories.map((c, ci) => (
                <li
                  key={c.id}
                  className={`py-2.5 transition-colors ${
                    drag?.kind === "category" && dragOverId === c.id
                      ? "bg-accent/10"
                      : ""
                  }`}
                  onDragOver={dragOver(c.id)}
                  onDrop={dropOnCategory(g.id, c.id)}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Drag ${c.name}`}
                      draggable
                      onDragStart={startDrag("category", c.id)}
                      onDragEnd={endDrag}
                      className="grid h-8 w-5 place-items-center text-fg/30 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical size={14} />
                    </button>
                    <input
                      type="text"
                      value={c.emoji ?? ""}
                      onChange={(e) =>
                        setCategoryEmoji(c.id, e.target.value)
                      }
                      maxLength={4}
                      placeholder="·"
                      aria-label={`Emoji for ${c.name}`}
                      className="w-8 rounded-md bg-card-elevated px-1 py-0.5 text-center text-sm outline-none placeholder:text-fg/30"
                    />
                    <EditableText
                      value={c.name}
                      onCommit={commitCategoryRename(c.id, c.name)}
                      ariaLabel={`Rename category ${c.name}`}
                      className={`flex-1 text-base ${c.hidden ? "italic text-fg/40" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setCategoryHidden(c.id, !c.hidden)}
                      aria-label={
                        c.hidden ? `Show ${c.name}` : `Hide ${c.name}`
                      }
                      aria-pressed={Boolean(c.hidden)}
                      className="grid h-8 w-8 place-items-center text-fg/55 hover:text-fg"
                    >
                      {c.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(c.id, -1)}
                      disabled={ci === 0}
                      aria-label={`Move ${c.name} up`}
                      className="grid h-8 w-8 place-items-center text-fg/55 hover:text-fg disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(c.id, 1)}
                      disabled={ci === g.categories.length - 1}
                      aria-label={`Move ${c.name} down`}
                      className="grid h-8 w-8 place-items-center text-fg/55 hover:text-fg disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${c.name}"? Its assignments, target, and pin are removed; existing transactions stay tagged with this name.`,
                          )
                        ) {
                          markUndoable(`Category "${c.name}" deleted`);
                          deleteCategory(c.id);
                        }
                      }}
                      aria-label={`Delete category ${c.name}`}
                      className="grid h-8 w-8 place-items-center text-rose-400/70 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <NoteEditor
                    value={c.note ?? ""}
                    onCommit={(next) => setCategoryNote(c.id, next)}
                    ariaLabel={`Note for ${c.name}`}
                    placeholder="Add a note"
                  />
                </li>
              ))}
            </ul>

            <form
              onSubmit={submitNewCategory(g.id)}
              className="mt-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={newCatNames[g.id] ?? ""}
                onChange={(e) =>
                  setNewCatNames((m) => ({ ...m, [g.id]: e.target.value }))
                }
                placeholder="Add a category"
                className="flex-1 rounded-md bg-card-elevated px-3 py-2 text-sm outline-none placeholder:text-fg/40"
              />
              <button
                type="submit"
                aria-label={`Add category to ${g.name}`}
                className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-accent"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </form>
          </section>
        ))}

        <form
          onSubmit={submitNewGroup}
          className="flex items-center gap-2 rounded-2xl bg-card p-4"
        >
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Add a group"
            className="flex-1 rounded-md bg-card-elevated px-3 py-2 text-base outline-none placeholder:text-fg/40"
          />
          <button
            type="submit"
            aria-label="Add group"
            className="grid h-10 w-10 place-items-center rounded-full bg-accent text-fg"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </>
  );
}
