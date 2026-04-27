# n8n-nodes-scrappa

Scrappa community node for n8n. Use Scrappa APIs in workflows for Google Search, Google Maps, YouTube, LinkedIn, Trustpilot, and any other Scrappa endpoint.

## Requirements

- n8n with community nodes enabled
- A Scrappa API key from https://scrappa.co

## Install

In n8n, go to **Settings > Community Nodes**, install:

```text
n8n-nodes-scrappa
```

For self-hosted command-line installs:

```bash
npm install n8n-nodes-scrappa
```

Restart n8n after installing the package.

## Credentials

Create a Scrappa API key from your Scrappa dashboard, then create a **Scrappa API** credential in n8n. The node sends it as the `X-API-KEY` header.

## Operations

- Google Search
- Google Maps search places
- Google Maps business details
- YouTube search
- YouTube video details
- LinkedIn profile
- LinkedIn company
- LinkedIn jobs search
- Trustpilot company search
- Trustpilot company reviews
- Custom endpoint for any `/api/...` Scrappa route

## Examples

Search Google:

1. Add a Scrappa node.
2. Choose **Google Search**.
3. Set **Query** to `best coffee shops berlin`.
4. Run the node.

Fetch LinkedIn profile data:

1. Add a Scrappa node.
2. Choose **LinkedIn: Profile**.
3. Set **URL** to a public LinkedIn profile URL.
4. Run the node.

Use an endpoint that does not have a dedicated operation yet:

1. Choose **Custom Endpoint**.
2. Set **Custom Endpoint Path** to a Scrappa API path like `/api/google/news`.
3. Add query parameters as JSON in **Additional Query Parameters**.

## Links

- Scrappa: https://scrappa.co
- API docs: https://scrappa.co/docs
- Authentication docs: https://scrappa.co/docs/authentication
- npm package: https://www.npmjs.com/package/n8n-nodes-scrappa
- Source: https://github.com/userlip/n8n-nodes-scrappa
