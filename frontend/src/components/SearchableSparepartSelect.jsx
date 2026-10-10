import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function SearchableSparepartSelect({
  items,
  value,
  onValueChange,
  getSearchText,
  getOptionLabel,
  renderOption,
  placeholder = "Pilih sparepart...",
  searchPlaceholder = "Cari nama atau kode sparepart...",
  emptyMessage = "Sparepart tidak ditemukan.",
  isDisabled = () => false,
  testId,
}) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => item.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between gap-2 font-normal"
          data-testid={testId}
        >
          <span className="truncate text-left">
            {selectedItem ? getOptionLabel(selectedItem) : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput autoFocus placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={getSearchText(item)}
                disabled={isDisabled(item)}
                onSelect={() => {
                  onValueChange(item.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value === item.id ? "opacity-100" : "opacity-0")} />
                {renderOption(item)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
