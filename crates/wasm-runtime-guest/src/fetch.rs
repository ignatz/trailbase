use wstd::http::Client;

pub use http::{Request, Uri};

pub async fn fetch<B: Into<wstd::http::Body>>(
  request: Request<B>,
) -> Result<Vec<u8>, wstd::http::Error> {
  let client = Client::new();
  let response = client.send(request).await?;
  return response
    .into_body()
    .bytes_contents()
    .await
    .map(|bytes| bytes.to_vec());
}

pub async fn get(uri: impl Into<http::Uri>) -> Result<Vec<u8>, wstd::http::Error> {
  return fetch(Request::builder().uri(uri.into()).body(()).expect("static")).await;
}
