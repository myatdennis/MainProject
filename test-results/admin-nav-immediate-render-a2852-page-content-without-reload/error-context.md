# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e6]:
    - heading "Unable to verify admin access" [level=2] [ref=e7]
    - paragraph [ref=e8]:
      - text: We hit a snag while confirming your admin access. You can retry the check or jump back to the login screen.
      - generic [ref=e9]: "Details: auth_unavailable"
      - generic [ref=e10]:
        - text: Ask an admin to add you to the
        - code [ref=e11]: admin_users
        - text: allowlist table.
    - generic [ref=e12]:
      - button "Try again" [ref=e13] [cursor=pointer]:
        - generic [ref=e14]: Try again
      - button "Copy User ID" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: Copy User ID
      - link "Go to admin login" [ref=e17] [cursor=pointer]:
        - /url: /admin/login
```