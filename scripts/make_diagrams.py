#!/usr/bin/env python3
"""Generate the three project architecture diagrams as plain SVG files.

Run from the repo root:  python3 scripts/make_diagrams.py
Output: site/assets/diagrams/{pipeline,k8s,jobs}.svg
"""
import os
from xml.sax.saxutils import escape

INK = "#0F1A2B"
SLATE = "#4A586B"
ACCENT = "#D3232F"
ACCENT_FILL = "#FBE9EA"
LINE = "#8C97A6"
FONT = "Arial, Helvetica, sans-serif"
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "assets", "diagrams")


class Diagram:
    def __init__(self, title, desc, width=640, height=360):
        self.w, self.h = width, height
        self.title, self.desc = title, desc
        self.parts = []

    def box(self, x, y, w, h, title, sub="", accent=False):
        stroke = ACCENT if accent else INK
        fill = ACCENT_FILL if accent else "#FFFFFF"
        sw = 2 if accent else 1.25
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        )
        cx = x + w / 2
        if sub:
            self.parts.append(f'<text x="{cx}" y="{y + h / 2 - 3}" text-anchor="middle" font-size="14" font-weight="700" fill="{INK}">{escape(title)}</text>')
            self.parts.append(f'<text x="{cx}" y="{y + h / 2 + 15}" text-anchor="middle" font-size="12.5" fill="{SLATE}">{escape(sub)}</text>')
        else:
            self.parts.append(f'<text x="{cx}" y="{y + h / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="{INK}">{escape(title)}</text>')

    def zone(self, x, y, w, h, label):
        self.parts.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="none" stroke="{LINE}" stroke-width="1.25" stroke-dasharray="5 4"/>'
        )
        self.parts.append(f'<text x="{x + 14}" y="{y + 20}" font-size="12.5" font-weight="700" fill="{SLATE}">{escape(label)}</text>')

    def arrow(self, x1, y1, x2, y2, accent=False):
        col = ACCENT if accent else INK
        self.parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="1.5" marker-end="url(#a{"r" if accent else "k"})"/>'
        )

    def note(self, x, y, text, anchor="start"):
        self.parts.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="12.5" fill="{SLATE}">{escape(text)}</text>')

    def save(self, name):
        os.makedirs(OUT, exist_ok=True)
        defs = (
            '<defs>'
            f'<marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{INK}"/></marker>'
            f'<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{ACCENT}"/></marker>'
            '</defs>'
        )
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
            f'role="img" aria-labelledby="t d" font-family="{FONT}">'
            f'<title id="t">{escape(self.title)}</title><desc id="d">{escape(self.desc)}</desc>'
            f'<rect width="{self.w}" height="{self.h}" fill="#FFFFFF"/>{defs}' + "".join(self.parts) + "</svg>\n"
        )
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(svg)


def pipeline():
    d = Diagram(
        "Secure DevSecOps pipeline",
        "A commit triggers a build, SAST, DAST and a compliance gate before deployment to EC2, with IAM, encrypted S3 and CloudTrail around it.",
    )
    xs = [10, 138, 266, 394, 522]
    labels = [("GitHub", "commit"), ("Build", "Docker image"), ("SAST", "code scan"), ("DAST", "running app"), ("Gate", "compliance")]
    for i, (x, (t, s)) in enumerate(zip(xs, labels)):
        d.box(x, 34, 100, 56, t, s, accent=(i == 4))
    for i in range(4):
        d.arrow(xs[i] + 100, 62, xs[i + 1] - 2, 62, accent=(i == 3))
    d.box(502, 150, 120, 56, "Deploy", "AWS EC2")
    d.arrow(572, 90, 572, 148, accent=True)
    d.zone(10, 232, 612, 108, "Around the deployment")
    d.box(24, 268, 184, 56, "IAM roles", "least privilege")
    d.box(224, 268, 184, 56, "S3 storage", "encrypted")
    d.box(424, 268, 184, 56, "Monitoring", "CloudTrail, CloudWatch")
    d.arrow(562, 206, 562, 230)
    d.save("pipeline.svg")


def k8s():
    d = Diagram(
        "Kubernetes microservices with monitoring and autoscaling",
        "Users reach services through Ingress. A horizontal pod autoscaler adjusts replicas. Prometheus scrapes metrics and feeds Grafana dashboards and alerting rules.",
    )
    d.box(10, 128, 90, 56, "Users", "traffic")
    d.box(124, 128, 96, 56, "Ingress", "routes traffic")
    d.arrow(100, 156, 122, 156)
    d.zone(244, 48, 386, 190, "Kubernetes cluster, deployed with Helm")
    for i, name in enumerate(["Service A", "Service B", "Service C"]):
        d.box(262 + i * 118, 80, 106, 56, name, "pods")
    d.arrow(220, 156, 242, 156)
    d.box(262, 170, 342, 48, "Horizontal Pod Autoscaler", "adds or removes pods with load", accent=True)
    d.arrow(433, 170, 433, 138, accent=True)
    d.box(244, 280, 190, 56, "Prometheus", "scrapes, alert rules")
    d.box(466, 280, 164, 56, "Grafana", "SLI and SLO dashboards")
    d.arrow(340, 238, 340, 278)
    d.arrow(434, 308, 464, 308)
    d.save("k8s.svg")


def jobs():
    d = Diagram(
        "AI DevOps job matcher",
        "EventBridge triggers a collector Lambda that searches the web and scores postings, then stores matches in DynamoDB. A second Lambda behind API Gateway serves a dashboard on S3.",
    )
    c1, c2, c3, c4 = 10, 170, 330, 490
    w = 140
    d.box(c1, 36, w, 56, "EventBridge", "every 6 hours")
    d.box(c2, 36, w, 56, "Lambda", "collector", accent=True)
    d.box(c3, 36, w, 56, "Search and AI", "find and score jobs")
    d.arrow(c1 + w, 64, c2 - 2, 64)
    d.arrow(c2 + w, 64, c3 - 2, 64)
    d.box(c2, 156, w, 56, "DynamoDB", "matches, 2-day TTL")
    d.arrow(c2 + w / 2, 92, c2 + w / 2, 154)
    d.box(c3, 156, w, 56, "Lambda", "get-matched-jobs")
    d.arrow(c3, 184, c2 + w + 2, 184)
    d.box(c4, 156, w, 56, "API Gateway", "HTTPS endpoint")
    d.arrow(c4, 184, c3 + w + 2, 184)
    d.box(c4, 276, w, 56, "Dashboard", "static site on S3")
    d.arrow(c4 + w / 2, 276, c4 + w / 2, 214)
    d.save("jobs.svg")


if __name__ == "__main__":
    pipeline()
    k8s()
    jobs()
    print("diagrams written to", os.path.normpath(OUT))
