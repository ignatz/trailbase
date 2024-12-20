import {
  createResource,
  createSignal,
  Match,
  Show,
  Switch,
  Suspense,
} from "solid-js";
import type { Setter, JSXElement } from "solid-js";
import { createForm } from "@tanstack/solid-form";
import { TbCrown } from "solid-icons/tb";
import type { DialogTriggerProps } from "@kobalte/core/dialog";

import {
  type ColumnDef,
  createColumnHelper,
  PaginationState,
} from "@tanstack/solid-table";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/FilterBar";
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/Table";
import { Label } from "@/components/ui/label";
import { AddUser } from "@/components/auth/AddUser";
import { deleteUser, updateUser } from "@/lib/user";
import type {
  UpdateUserRequest,
  UserJson,
  ListUsersResponse,
} from "@/lib/bindings";
import {
  buildTextFormField,
  buildOptionalTextFormField,
} from "@/components/FormFields";
import { SafeSheet, SheetContainer } from "@/components/SafeSheet";
import { adminFetch } from "@/lib/fetch";

type FetchArgs = {
  filter: string | undefined;
  pageSize: number;
  pageIndex: number;
  cursors: string[];
};

export async function fetchUsers(
  source: FetchArgs,
  { value }: { value: ListUsersResponse | undefined },
): Promise<ListUsersResponse> {
  const pageIndex = source.pageIndex;
  const limit = source.pageSize;
  const cursors = source.cursors;

  const filter = source.filter ?? "";
  const filterQuery = filter
    .split("AND")
    .map((frag) => frag.trim().replaceAll(" ", ""))
    .join("&");

  console.log("QUERY: ", filterQuery);

  const params = new URLSearchParams(filterQuery);
  params.set("limit", limit.toString());

  // Build the next UUIDv7 "cursor" from previous response and update local
  // cursor stack. If we're paging forward we add new cursors, otherwise we're
  // re-using previously seen cursors for consistency. We reset if we go back
  // to the start.
  if (pageIndex === 0) {
    cursors.length = 0;
  } else {
    const index = pageIndex - 1;
    if (index < cursors.length) {
      // Already known page
      params.set("cursor", cursors[index]);
    } else {
      // New page case: use cursor from previous response or fall back to more
      // expensive and inconsistent offset-based pagination.
      const cursor = value?.cursor;
      if (cursor) {
        cursors.push(cursor);
        params.set("cursor", cursor);
      } else {
        params.set("offset", `${pageIndex * source.pageSize}`);
      }
    }
  }

  try {
    const response = await adminFetch(`/user?${params}`);
    return await response.json();
  } catch (err) {
    if (value) {
      return value;
    }
    throw err;
  }
}

const columnHelper = createColumnHelper<UserJson>();

function buildColumns(
  setEditUser: Setter<UserJson | undefined>,
  userRefetch: () => void,
): ColumnDef<UserJson>[] {
  return [
    {
      header: "id",
      accessorFn: ({ id }) => id,
    },
    columnHelper.accessor("email", { header: "email" }) as ColumnDef<UserJson>,
    {
      header: "verified",
      accessorFn: ({ verified }) => Boolean(verified),
    },
    columnHelper.accessor("id", {
      header: "Admin",
      cell: (ctx) => (
        <div class="ml-[10px]">
          {ctx.row.original.admin ? <TbCrown size={20} /> : null}
        </div>
      ),
    }) as ColumnDef<UserJson>,
    columnHelper.display({
      header: "Actions",
      cell: (ctx) => {
        const userId = ctx.row.original.id;
        return (
          <div class="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                console.debug(ctx.row.original);
                setEditUser(ctx.row.original);
              }}
            >
              edit
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                deleteUser(userId).then(userRefetch).catch(console.error);
              }}
            >
              delete
            </Button>
          </div>
        );
      },
    }),
  ];
}

function EditSheetContent(props: {
  user: UserJson;
  close: () => void;
  markDirty: () => void;
  refetch: () => void;
}) {
  const form = createForm<UpdateUserRequest>(() => ({
    defaultValues: {
      id: props.user.id,
      email: props.user.email,
      password: null,
      verified: props.user.verified,
    },
    onSubmit: async ({ value }) => {
      updateUser(value)
        .then(() => props.close())
        .catch(console.error);

      props.refetch();
    },
  }));

  return (
    <SheetContainer>
      <SheetHeader>
        <SheetTitle>Edit User</SheetTitle>
        <SheetDescription>
          Change a user's properties. Be careful
        </SheetDescription>
      </SheetHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div class="flex flex-col items-center gap-4 py-4">
          <form.Field name={"email"}>
            {buildTextFormField({
              label: () => <L>E-mail</L>,
              type: "email",
            })}
          </form.Field>

          <form.Field name="password">
            {buildOptionalTextFormField({
              label: () => <L>Password</L>,
              type: "password",
            })}
          </form.Field>

          <form.Field name="verified">
            {(field) => (
              <div class="w-full flex gap-2 items-center justify-end">
                <Label>Verified</Label>
                <Checkbox
                  checked={field().state.value ?? false}
                  onChange={field().handleChange}
                />
              </div>
            )}
          </form.Field>
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
                  {state().isSubmitting ? "..." : "Submit"}
                </Button>
              );
            }}
          />
        </SheetFooter>
      </form>
    </SheetContainer>
  );
}

export function UserTable() {
  const [filter, setFilter] = createSignal<string | undefined>();
  const [pagination, setPagination] = createSignal<PaginationState>({
    pageSize: 20,
    pageIndex: 0,
  });
  const cursors: string[] = [];

  const buildFetchArgs = (): FetchArgs => ({
    pageSize: pagination().pageSize,
    pageIndex: pagination().pageIndex,
    cursors: cursors,
    filter: filter(),
  });

  const [users, { refetch }] = createResource(buildFetchArgs, fetchUsers);
  const [editUser, setEditUser] = createSignal<UserJson | undefined>();

  const columns = () => buildColumns(setEditUser, refetch);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Switch>
        <Match when={users.error}>
          <span>Error: {users.error}</span>
        </Match>

        <Match when={users()}>
          <div class="flex flex-col gap-4 items-end">
            <FilterBar
              initial={filter()}
              onSubmit={(value: string) => {
                if (value === filter()) {
                  refetch();
                } else {
                  setFilter(value);
                }
              }}
              example='e.g. "email[like]=%@foo.com"'
            />

            <div class="w-full space-y-2.5">
              <DataTable
                columns={columns}
                data={() => users()?.users}
                rowCount={Number(users()?.total_row_count)}
                initialPagination={pagination()}
                onPaginationChange={setPagination}
              />
            </div>

            <SafeSheet
              children={(sheet) => {
                return (
                  <>
                    <SheetContent class={sheetMaxWidth}>
                      <AddUser userRefetch={refetch} {...sheet} />
                    </SheetContent>

                    <SheetTrigger
                      as={(props: DialogTriggerProps) => (
                        <Button
                          variant="outline"
                          class="flex gap-2"
                          onClick={() => {}}
                          {...props}
                        >
                          Add User
                        </Button>
                      )}
                    />
                  </>
                );
              }}
            />

            {/* WARN: This might open multiple sheets or at least scrims for each row */}
            <SafeSheet
              open={[
                () => editUser() !== undefined,
                (isOpen: boolean | ((value: boolean) => boolean)) => {
                  if (!isOpen) {
                    setEditUser(undefined);
                  }
                },
              ]}
              children={(sheet) => {
                return (
                  <SheetContent class={sheetMaxWidth}>
                    <Show when={editUser()}>
                      <EditSheetContent
                        user={editUser()!}
                        refetch={refetch}
                        {...sheet}
                      />
                    </Show>
                  </SheetContent>
                );
              }}
            />
          </div>
        </Match>
      </Switch>
    </Suspense>
  );
}

function L(props: { children: JSXElement }) {
  return <div class="w-32">{props.children}</div>;
}

const sheetMaxWidth = "sm:max-w-[520px]";
