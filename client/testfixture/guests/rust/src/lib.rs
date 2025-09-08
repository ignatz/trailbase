#![forbid(unsafe_code)]
#![allow(clippy::needless_return)]
#![warn(clippy::await_holding_lock, clippy::inefficient_to_string)]

use trailbase_wasm::db::{Transaction, Value, execute, query};
use trailbase_wasm::fetch::{Uri, get};
use trailbase_wasm::fs::read_file;
use trailbase_wasm::http::{HttpError, HttpRoute, Json, StatusCode, routing};
use trailbase_wasm::job::Job;
use trailbase_wasm::time::{Duration, SystemTime, Timer};
use trailbase_wasm::{Guest, export};

// Implement the function exported in this world (see above).
struct Endpoints;

impl Guest for Endpoints {
  fn http_handlers() -> Vec<HttpRoute> {
    return vec![
      routing::get("/readfile", async |_req| {
        let r = read_file("/crates/sqlite/Cargo.toml")
          .map_err(|err| HttpError::message(StatusCode::NOT_FOUND, err))?;
        println!("result: {}", String::from_utf8_lossy(&r));
        return Ok(());
      }),
      routing::get("/json", async |_req| {
        let value = serde_json::json!({
            "int": 5,
            "real": 4.2,
            "msg": "foo",
            "obj": {
              "nested": true,
            },
        });

        return Json(value);
      }),
      routing::get("/fetch", async |req| {
        if let Some(url) = req.query_param("url") {
          let uri: Uri = Uri::try_from(url).map_err(internal)?;
          return get(uri).await.map_err(internal);
        }

        return Err(HttpError::message(
          StatusCode::BAD_REQUEST,
          "Missing ?url= param",
        ));
      }),
      routing::get("/error", async |_req| -> Result<(), HttpError> {
        return Err(HttpError {
          status: StatusCode::IM_A_TEAPOT,
          message: Some("I'm a teapot".to_string()),
        });
      }),
      routing::get("/await", async |req| -> Result<Vec<u8>, HttpError> {
        let ms: u64 = req.query_param("ms").map_or(10, |p| p.parse().unwrap());

        Timer::after(Duration::from_millis(ms)).wait().await;
        return Ok(vec![b'A'; 5000]);
      }),
      // Test Database interactions
      routing::get("/addDeletePost", async |_req| {
        let user_id = &query(
          "SELECT id FROM _user WHERE email = 'admin@localhost'".to_string(),
          vec![],
        )
        .await
        .map_err(internal)?[0][0];

        println!("user id: {user_id:?}");

        let now = SystemTime::now();
        let num_insertions = execute(
          "INSERT INTO post (author, title, body) VALUES (?1, 'title' , ?2)".to_string(),
          vec![user_id.clone(), Value::Text(format!("{now:?}"))],
        )
        .await
        .unwrap();

        let num_deletions = execute(
          "DELETE FROM post WHERE body = ?1".to_string(),
          vec![Value::Text(format!("{now:?}"))],
        )
        .await
        .unwrap();

        if num_insertions != num_deletions {
          panic!("{num_insertions} insertions vs {num_deletions} deletions");
        }

        return Ok("Ok");
      }),
      routing::get("/transaction", async |_req| {
        let mut tx = Transaction::begin().map_err(internal)?;
        tx.execute(
          "CREATE TABLE IF NOT EXISTS tx (id INTEGER PRIMARY KEY)",
          &[],
        )
        .map_err(internal)?;

        let rows = tx.query("SELECT COUNT(*) FROM tx", &[]).map_err(internal)?;
        let Value::Integer(count) = &rows[0][0] else {
          return Err(internal("expected int"));
        };

        let rows_affected = tx
          .execute(
            "INSERT INTO tx (id) VALUES (?1)",
            &[Value::Integer(count + 1)],
          )
          .map_err(internal)?;

        assert_eq!(1, rows_affected);

        tx.commit().map_err(internal)?;

        return Ok(());
      }),
      // Benchmark runtime performance.
      routing::get("/fibonacci", async |req| {
        let n: usize = req.query_param("n").map_or(40, |p| p.parse().unwrap());
        return format!("{}\n", fibonacci(n));
      }),
    ];
  }

  fn job_handlers() -> Vec<Job> {
    return vec![Job::hourly("WASM-registered Job", async || {
      println!("JS-registered cron job reporting for duty 🚀");
    })];
  }
}

export!(Endpoints);

#[inline]
fn fibonacci(n: usize) -> usize {
  return match n {
    0 => 0,
    1 => 1,
    n => fibonacci(n - 1) + fibonacci(n - 2),
  };
}

fn internal(err: impl std::string::ToString) -> HttpError {
  return HttpError::message(StatusCode::INTERNAL_SERVER_ERROR, err);
}
