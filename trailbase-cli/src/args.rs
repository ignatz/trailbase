use clap::{Args, Parser, Subcommand, ValueEnum};

use trailbase_core::api::JsonSchemaMode;
use trailbase_core::DataDir;
use trailbase_core::ServerOptions;

#[derive(ValueEnum, Clone, Copy, Debug)]
pub enum JsonSchemaModeArg {
  /// Insert mode.
  Insert,
  /// Read/Select mode.
  Select,
  /// Update mode.
  Update,
}

impl From<JsonSchemaModeArg> for JsonSchemaMode {
  fn from(value: JsonSchemaModeArg) -> Self {
    match value {
      JsonSchemaModeArg::Insert => Self::Insert,
      JsonSchemaModeArg::Select => Self::Select,
      JsonSchemaModeArg::Update => Self::Update,
    }
  }
}

/// Command line arguments for TrailBase's CLI.
///
/// NOTE: a good rule of thumb for thinking of proto config vs CLI options: if it requires a
/// server restart, it should probably be a CLI option and a config option otherwise.
#[derive(Parser, Debug, Clone, Default)]
#[command(version, about, long_about = None)]
pub struct DefaultCommandLineArgs {
  /// Directory for runtime files including the database. Will be created by TrailBase if dir
  /// doesn't exist.
  #[arg(long, env, default_value = DataDir::DEFAULT)]
  pub data_dir: std::path::PathBuf,

  #[command(subcommand)]
  pub cmd: Option<SubCommands>,
}

#[derive(Subcommand, Debug, Clone)]
pub enum SubCommands {
  /// Starts the HTTP server.
  Run(ServerArgs),
  /// Export JSON Schema definitions.
  Schema(JsonSchemaArgs),
  #[cfg(feature = "openapi")]
  /// Export OpenAPI definitions.
  OpenApi {
    #[command(subcommand)]
    cmd: Option<OpenApiSubCommands>,
  },
  /// Creates new empty migration file.
  Migration {
    /// Optional suffix used for the generated migration file: U<timetamp>__<suffix>.sql.
    suffix: Option<String>,
  },
  /// Simple admin management (use dashboard for everything else).
  Admin {
    #[command(subcommand)]
    cmd: Option<AdminSubCommands>,
  },
  /// Simple user management (use dashboard for everything else).
  User {
    #[command(subcommand)]
    cmd: Option<UserSubCommands>,
  },
  /// Programmatically send emails.
  Email(EmailArgs),
}

#[derive(Args, Clone, Debug)]
pub struct ServerArgs {
  /// Address the HTTP server binds to (Default: localhost:4000).
  #[arg(short, long, env, default_value = "127.0.0.1:4000")]
  address: String,

  #[arg(long, env)]
  admin_address: Option<String>,

  /// Optional path to static assets that will be served at the HTTP root.
  #[arg(long, env)]
  public_dir: Option<String>,

  /// Sets CORS policies to permissive in order to allow cross-origin requests
  /// when developing the UI using a separate dev server.
  #[arg(long)]
  pub dev: bool,

  #[arg(long, default_value_t = false)]
  pub stderr_logging: bool,

  /// Disable the built-in public authentication (login, logout, ...) UI.
  #[arg(long, default_value_t = false)]
  disable_auth_ui: bool,

  /// Limit the set of allowed origins the HTTP server will answer to.
  #[arg(long, default_value = "*")]
  cors_allowed_origins: Vec<String>,
}

#[derive(Args, Clone, Debug)]
pub struct JsonSchemaArgs {
  /// Name of the table to infer the JSON Schema from.
  pub table: String,

  /// Use-case for the type that determines which columns/fields will be required [Default:
  /// Insert].
  #[arg(long, env)]
  pub mode: Option<JsonSchemaModeArg>,
}

#[derive(Args, Clone, Debug)]
pub struct EmailArgs {
  /// Receiver address, e.g. foo@bar.baz.
  #[arg(long, env)]
  pub to: String,

  /// Subject line of the email to be sent.
  #[arg(long, env)]
  pub subject: String,

  /// Email body, i.e. the actual message.
  #[arg(long, env)]
  pub body: String,
}

#[cfg(feature = "openapi")]
#[derive(Subcommand, Debug, Clone)]
pub enum OpenApiSubCommands {
  Print,
  Run {
    #[arg(long, default_value_t = 4004)]
    port: u16,
  },
}

#[derive(Subcommand, Debug, Clone)]
pub enum AdminSubCommands {
  /// Lists admin users.
  List,
  /// Demotes admin user to normal user.
  Demote {
    /// E-mail of the admin who's demoted.
    email: String,
  },
  /// Promotes user to admin.
  Promote {
    /// E-mail of the user who's promoted to admin.
    email: String,
  },
}

#[derive(Subcommand, Debug, Clone)]
pub enum UserSubCommands {
  // TODO: create new user. Low prio, use dashboard.
  /// Resets a users password.
  ResetPassword {
    /// E-mail of the user who's password is being reset.
    email: String,
    /// Password to set.
    password: String,
  },
  /// Mint auth tokens for the given user.
  MintToken { email: String },
}

impl TryFrom<DefaultCommandLineArgs> for ServerOptions {
  type Error = &'static str;

  fn try_from(value: DefaultCommandLineArgs) -> Result<Self, Self::Error> {
    let Some(SubCommands::Run(args)) = value.cmd else {
      return Err("Trying to initialize server w/o the \"run\" sub command being passed.");
    };

    return Ok(ServerOptions {
      data_dir: DataDir(value.data_dir),
      address: args.address,
      admin_address: args.admin_address,
      public_dir: args.public_dir.map(|p| p.into()),
      dev: args.dev,
      disable_auth_ui: args.disable_auth_ui,
      cors_allowed_origins: args.cors_allowed_origins,
    });
  }
}
