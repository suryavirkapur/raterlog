import { MenuItem } from "@blueprintjs/core";
import { Omnibar } from "@blueprintjs/select";
import type { IconName } from "@blueprintjs/core";

export type PaletteItem = {
  id: string;
  label: string;
  icon?: IconName;
  emoji?: string;
  hint?: string;
  keywords?: string;
  run: () => void;
};

const Omni = Omnibar.ofType<PaletteItem>();

/** Cmd/Ctrl+K command palette for jumping to projects, channels, pages and actions. */
export function CommandPalette({
  isOpen,
  onClose,
  items,
}: {
  isOpen: boolean;
  onClose: () => void;
  items: PaletteItem[];
}) {
  return (
    <Omni
      isOpen={isOpen}
      onClose={onClose}
      items={items}
      resetOnSelect
      inputProps={{ placeholder: "Jump to a page, project or channel…", leftIcon: "search" }}
      itemPredicate={(query, item) =>
        `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(query.toLowerCase())
      }
      itemRenderer={(item, { handleClick, modifiers }) => (
        <MenuItem
          key={item.id}
          icon={
            item.emoji ? (
              <span aria-hidden style={{ fontSize: 14 }}>
                {item.emoji}
              </span>
            ) : (
              item.icon
            )
          }
          text={item.label}
          label={item.hint}
          active={modifiers.active}
          onClick={handleClick}
          shouldDismissPopover={false}
        />
      )}
      onItemSelect={(item) => {
        onClose();
        item.run();
      }}
      noResults={<MenuItem disabled text="No results" icon="search" />}
    />
  );
}
