#[cfg(test)]
mod tests {
  use crate::AppState;
  use libsql::{params, Connection};
  use trailbase_sqlite::query_one_row;

  pub async fn create_chat_message_app_tables(state: &AppState) -> Result<(), libsql::Error> {
    // Create a messages, chat room and members tables.
    state
      .conn()
      .execute_batch(
        r#"
          CREATE TABLE room (
            id           BLOB PRIMARY KEY NOT NULL CHECK(is_uuid_v7(id)) DEFAULT(uuid_v7()),
            name         TEXT
          ) STRICT;

          CREATE TABLE message (
            id           BLOB PRIMARY KEY NOT NULL CHECK(is_uuid_v7(id)) DEFAULT (uuid_v7()),
            _owner       BLOB NOT NULL,
            room         BLOB NOT NULL,
            data         TEXT NOT NULL DEFAULT 'empty',

            -- on user delete, toombstone it.
            FOREIGN KEY(_owner) REFERENCES _user(id) ON DELETE SET NULL,
            -- On chatroom delete, delete message
            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE
          ) STRICT;

          CREATE TABLE room_members (
            user         BLOB NOT NULL,
            room         BLOB NOT NULL,

            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE,
            FOREIGN KEY(user) REFERENCES _user(id) ON DELETE CASCADE
          ) STRICT;
        "#,
      )
      .await?;

    state.table_metadata().invalidate_all().await.unwrap();

    return Ok(());
  }

  pub async fn create_chat_message_app_tables_integer(
    state: &AppState,
  ) -> Result<(), libsql::Error> {
    // Create a messages, chat room and members tables.
    state
      .conn()
      .execute_batch(
        r#"
          CREATE TABLE room (
            id           BLOB PRIMARY KEY NOT NULL CHECK(is_uuid_v7(id)) DEFAULT(uuid_v7()),
            name         TEXT
          ) STRICT;

          CREATE TABLE message (
            id           INTEGER PRIMARY KEY,
            _owner       BLOB NOT NULL,
            room         BLOB NOT NULL,
            data         TEXT NOT NULL DEFAULT 'empty',

            -- on user delete, toombstone it.
            FOREIGN KEY(_owner) REFERENCES _user(id) ON DELETE SET NULL,
            -- On chatroom delete, delete message
            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE
          ) STRICT;

          CREATE TABLE room_members (
            user         BLOB NOT NULL,
            room         BLOB NOT NULL,

            FOREIGN KEY(room) REFERENCES room(id) ON DELETE CASCADE,
            FOREIGN KEY(user) REFERENCES _user(id) ON DELETE CASCADE
          ) STRICT;
        "#,
      )
      .await?;

    state.table_metadata().invalidate_all().await.unwrap();

    return Ok(());
  }

  pub async fn add_room(conn: &Connection, name: &str) -> Result<[u8; 16], libsql::Error> {
    let room: [u8; 16] = query_one_row(
      conn,
      "INSERT INTO room (name) VALUES ($1) RETURNING id",
      params!(name),
    )
    .await?
    .get(0)?;

    return Ok(room);
  }

  pub async fn add_user_to_room(
    conn: &Connection,
    user: [u8; 16],
    room: [u8; 16],
  ) -> Result<(), libsql::Error> {
    conn
      .execute(
        "INSERT INTO room_members (user, room) VALUES ($1, $2)",
        params!(user, room),
      )
      .await?;
    return Ok(());
  }

  pub async fn send_message(
    conn: &Connection,
    user: [u8; 16],
    room: [u8; 16],
    message: &str,
  ) -> Result<[u8; 16], libsql::Error> {
    return query_one_row(
      conn,
      "INSERT INTO message (_owner, room, data) VALUES ($1, $2, $3) RETURNING id",
      params!(user, room, message),
    )
    .await?
    .get(0);
  }
}

#[cfg(test)]
pub(crate) use tests::*;
