import { For } from "solid-js";
import { createForm } from "@tanstack/solid-form";

import { SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import type { Column, Table, UpdateRowRequest } from "@/lib/bindings";
import { formFieldBuilder } from "@/components/FormFields";
import {
  findPrimaryKeyColumnIndex,
  getDefaultValue,
  isNotNull,
  isOptional,
} from "@/lib/schema";
import { adminFetch } from "@/lib/fetch";
import { SheetContainer } from "@/components/SafeSheet";
import { showToast } from "@/components/ui/toast";

// NOTE: We use `unknown` here over `Object` to prevent forms from doing infinite-recursion type gymnastics.
type Row = { [key: string]: unknown };

export function copyAndConvert(row: Row): {
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  [key: string]: Object | undefined;
} {
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    Object.entries(row).map(([k, v]) => [k, v as Object | undefined]),
  );
}

async function insertRow(tableName: string, row: Row) {
  const response = await adminFetch(`/table/${tableName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(row),
  });

  return await response.text();
}

async function updateRow(table: Table, row: Row) {
  const tableName = table.name;
  const primaryKeyColumIndex = findPrimaryKeyColumnIndex(table.columns);
  if (primaryKeyColumIndex < 0) {
    throw Error("No primary key column found.");
  }
  const pkColName = table.columns[primaryKeyColumIndex].name;

  const pkValue = row[pkColName];
  if (pkValue === undefined) {
    throw Error("Row is missing primary key.");
  }
  const copy = {
    ...row,
  };
  copy[pkColName] = undefined;

  const request: UpdateRowRequest = {
    primary_key_column: pkColName,
    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
    primary_key_value: pkValue as Object,
    row: copyAndConvert(copy),
  };

  const response = await adminFetch(`/table/${tableName}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  return await response.text();
}

function buildDefault(schema: Table): Row {
  const obj: Row = {};
  for (const col of schema.columns) {
    const optional = isOptional(col.options);
    if (optional) {
      // obj[col.name] = undefined;
      continue;
    }

    switch (col.data_type) {
      case "Blob":
        obj[col.name] = [];
        break;
      case "Text":
        obj[col.name] = "";
        break;
      case "Real":
        obj[col.name] = 0.0;
        break;
      case "Integer":
        obj[col.name] = 0;
        break;
      case "Null":
        break;
    }
  }
  return obj;
}

export function InsertAlterRowForm(props: {
  close: () => void;
  markDirty: () => void;
  rowsRefetch: () => void;
  schema: Table;
  row?: Row;
}) {
  const original = props.row
    ? JSON.parse(JSON.stringify(props.row))
    : undefined;

  const form = createForm<Row>(() => ({
    defaultValues: props.row ?? buildDefault(props.schema),
    onSubmit: async ({ value }) => {
      console.debug("Submitting:", value);
      try {
        if (original) {
          const response = await updateRow(props.schema, value);
          console.debug("UpdateRowResponse:", response);
        } else {
          const response = await insertRow(props.schema.name, value);
          console.debug("InsertRowResponse:", response);
        }

        props.rowsRefetch();
        props.close();
      } catch (err) {
        showToast({
          title: "Uncaught Error",
          description: `${err}`,
          variant: "error",
        });
      }
    },
  }));

  form.useStore((state) => {
    if (state.isDirty && !state.isSubmitted) {
      props.markDirty();
    }
  });

  return (
    <SheetContainer>
      <SheetHeader>
        <SheetTitle>{original ? "Edit Row" : "Insert New Row"}</SheetTitle>
      </SheetHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div class="flex flex-col items-start gap-4 py-4">
          <For each={props.schema.columns}>
            {(col: Column) => {
              const notNull = isNotNull(col.options);
              const label = `${col.name} [${col.data_type}${notNull ? "" : "?"}]`;
              const optional = isOptional(col.options);
              const defaultValue = getDefaultValue(col.options);

              return (
                <form.Field
                  name={col.name}
                  validators={{
                    onChange: ({ value }: { value: string | undefined }) => {
                      const defaultValue = getDefaultValue(col.options);
                      if (defaultValue !== undefined) {
                        return undefined;
                      }
                      return value !== undefined ? undefined : "Missing value";
                    },
                  }}
                  children={formFieldBuilder(
                    col.data_type,
                    label,
                    optional,
                    defaultValue,
                  )}
                />
              );
            }}
          </For>
        </div>

        <SheetFooter>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
            children={(state) => {
              return (
                <Button
                  type="submit"
                  disabled={!state().canSubmit}
                  variant="default"
                >
                  {state().isSubmitting
                    ? "..."
                    : original
                      ? "Update"
                      : "Insert"}
                </Button>
              );
            }}
          />
        </SheetFooter>
      </form>
    </SheetContainer>
  );
}
