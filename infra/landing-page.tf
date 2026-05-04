locals {
  landing_page_domain = var.landing_page_domain != "" ? var.landing_page_domain : "${var.project_name}.${var.domain}"
}

resource "vercel_project" "landing_page" {
  name             = var.project_name
  build_command    = null
  output_directory = null
}

resource "vercel_project_domain" "landing_page" {
  project_id = vercel_project.landing_page.id
  domain     = local.landing_page_domain
}
