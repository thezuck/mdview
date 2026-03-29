# Mobile ADHD Support App for High School Students Preparing for College

**Status:** draft

## Attached Resources

### Documents

- [f2](https://liveprd-staging-content.s3.us-east-1.amazonaws.com/organizations/9678e7bc-4ec4-4b92-be26-140a7941c76d/resources/019c7cb8-919c-70d7-88ca-35d37fe0a499.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIASLAUOUB55YBHG6AC%2F20260221%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260221T082221Z&X-Amz-Expires=604800&X-Amz-Signature=1f74e90e0d18e6ea1c1a5584c4654b161ba8f113441a487fd14553d27bd7cc8f&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject)

### Screens

![image](data:image/png;base64,[removed])
*image*

![home](data:image/png;base64,[removed])
*home*

![image](data:image/png;base64,[removed])
*image*

![image](data:image/png;base64,[removed])
*image*

![image](data:image/png;base64,[removed])
*image*

![image](data:image/png;base64,[removed])
*image*

![image](data:image/png;base64,[removed])
*image*

![after](data:image/png;base64,[removed])
*after*

![fred](data:image/png;base64,[removed])
*fred*


## Specification

### Context

###### Initiative overview
- Build a mobile app designed to support users with ADHD.
- The product is intended to help ADHD users with day-to-day challenges; specific primary problem area to be confirmed (e.g., task management, focus support, habit building).
###### Target audience (v1)
- Primary target users: high school students with ADHD (ages 16–18) preparing for college.
- Audience context: school-focused now, with near-term transition needs (planning, readiness, and routines for college).
- Secondary stakeholders (v1): school staff supporting the student (counselors/teachers/IEP/504 coordinators).
![image](data:image/png;base64,[removed])
*image*
![image](data:image/png;base64,[removed])
*image*
![image](data:image/png;base64,[removed])
*image*

### Goals

![image](data:image/png;base64,[removed])
*image*
![image](data:image/png;base64,[removed])
*image*

### Users & Use Cases

###### Primary persona (v1)
- High school student (ages 16–18) with ADHD who is preparing for college.
- Environment: balancing classes, homework, extracurriculars, test prep, and application deadlines.
- Primary need: support for day-to-day executive functioning with added emphasis on upcoming transition to college.
###### Secondary persona / stakeholder (v1)
- School staff supporting the student (e.g., counselors, teachers, IEP/504 coordinators).
- Typical context: supports accommodations, planning, and readiness for postsecondary transition.
- Note: the specific account relationship, permissions, and data visibility model for staff is TBD.
###### Core use-case areas (to be refined)
- Keep track of assignments, tests, and deadlines.
- Build and maintain routines/study habits.
- Manage attention/focus during study sessions.
- Plan and execute multi-step, long-horizon goals (e.g., college applications) without falling behind.

### Solution

### UX & Requirements

###### Initial reference UI observations (from shared image)
- The reference shows a likely home/dashboard screen with:
- A greeting header (e.g., “Good morning”).
- A task/to-do list with multiple items.
- A progress indicator or focus-timer element.
- A bottom navigation bar with multiple primary sections (icons suggest Home, Tasks, Focus, Profile or similar).
- Visual style appears clean/minimal, consistent with an ADHD-friendly, low-distraction UI direction.
- A subsequent shared image appears to be an app icon/logo: a bold letter “F” on a dark background.
- A later shared image appears to be unrelated to the ADHD mobile app UI: a Jira issue selection modal in the “FRED” interface for importing Jira issues into a LiveSpec (includes search + filters for Project/Type/Status/Assignee/Priority, issue list with checkboxes, and “Import selection” CTA).
###### UX decisions pending
- Confirm whether the shared screen is (a) an existing app to emulate, (b) a design mockup for this product, or (c) an unrelated reference.
- Confirm which modules from the reference are in scope for v1 (e.g., tasks, focus timer, progress tracking, navigation structure).
- Confirm whether the “F” logo/icon is the intended brand/app icon for this product or an unrelated reference asset.
- Confirm whether the Jira/FRED modal screenshot is intentionally in scope as a reference (e.g., the product includes Jira import), or was shared accidentally/unrelated to this requirement.

### Technical & Risks

![home](data:image/png;base64,[removed])
*home*

### Rollout

### Open Questions

###### Product definition questions
- What is the primary user problem to solve in v1 (task management, focus/attention support, habit building, reminders, emotional regulation, etc.)?
- What platform(s) are in scope for initial release (iOS, Android, both)?
- Secondary users/stakeholders (v1) are school staff (counselors/teachers/IEP/504 coordinators). What is their relationship to the student’s account (invited collaborator vs. separate staff account), and what permissions/data visibility do they have?
- Is the shared image a target design mockup for this product, or a reference/inspiration? If reference, which elements should be adopted (tasks list, focus timer/progress, bottom navigation structure)?
- Does the image showing a bold letter “F” represent the intended app icon/logo for this product? If yes, are there brand guidelines (colors, typography, icon style) to follow?
- Is the newly shared Jira/FRED “Import Jira issues” modal screenshot related to this requirement (e.g., the ADHD product includes Jira integration), or was it shared accidentally/unrelated?

### TODO

###### Discovery TODOs
- Confirm the primary use case/problem area for the ADHD app (choose a v1 focus).
- Define key scenarios for the v1 persona: high school students with ADHD (ages 16–18) preparing for college.
- Define the school-staff stakeholder model for v1 (counselors/teachers/IEP/504 coordinators): onboarding/invite flow, permissions, and data-sharing boundaries.
- Define initial platform scope (iOS/Android) and any accessibility requirements.
