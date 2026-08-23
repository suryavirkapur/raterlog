import { Link } from '@tanstack/react-router';
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import { Container, Box, Flex, Heading, Button, Badge, Text, Grid, Card, Separator, Avatar } from '@radix-ui/themes';

function Nav() {
  return /* @__PURE__ */ jsx(Box, {
    asChild: true,
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      background: "rgba(30, 30, 30, 0.8)",
      borderBottom: "1px solid var(--gray-a4)"
    },
    children: /* @__PURE__ */ jsx("nav", { children: /* @__PURE__ */ jsx(Container, {
      size: "3",
      px: "4",
      children: /* @__PURE__ */ jsxs(Flex, {
        justify: "between",
        align: "center",
        py: "3",
        children: [/* @__PURE__ */ jsxs(Flex, {
          align: "center",
          gap: "3",
          children: [/* @__PURE__ */ jsx(Link, {
            to: "/",
            style: {
              display: "flex",
              alignItems: "center"
            },
            children: /* @__PURE__ */ jsx("img", {
              src: "/icon.png",
              alt: "Raterlog",
              width: 26,
              height: 26
            })
          }), /* @__PURE__ */ jsx(Link, {
            to: "/",
            style: { textDecoration: "none" },
            children: /* @__PURE__ */ jsx(Heading, {
              size: "4",
              weight: "bold",
              style: {
                color: "var(--gray-12)",
                letterSpacing: "-0.02em"
              },
              children: "raterlog"
            })
          })]
        }), /* @__PURE__ */ jsxs(Flex, {
          align: "center",
          gap: "3",
          children: [/* @__PURE__ */ jsx(Button, {
            variant: "ghost",
            size: "2",
            asChild: true,
            children: /* @__PURE__ */ jsx(Link, {
              to: "/signin",
              style: { textDecoration: "none" },
              children: "Log in"
            })
          }), /* @__PURE__ */ jsx(Button, {
            size: "2",
            asChild: true,
            children: /* @__PURE__ */ jsx(Link, {
              to: "/signup",
              style: { textDecoration: "none" },
              children: "Sign up"
            })
          })]
        })]
      })
    }) })
  });
}
function Home() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Nav, {}), /* @__PURE__ */ jsxs(Container, {
    size: "3",
    px: "4",
    py: "2",
    children: [
      /* @__PURE__ */ jsx(CallToAction, {}),
      /* @__PURE__ */ jsx(Features, {}),
      /* @__PURE__ */ jsx(Testimonials, {}),
      /* @__PURE__ */ jsx(Pricing, {}),
      /* @__PURE__ */ jsx(Footer, {})
    ]
  })] });
}
function CallToAction() {
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gapY: "6",
    py: "9",
    align: "center",
    style: { textAlign: "center" },
    children: [
      /* @__PURE__ */ jsx(Badge, {
        size: "2",
        variant: "soft",
        children: "Real-time monitoring platform"
      }),
      /* @__PURE__ */ jsxs(Heading, {
        size: "9",
        style: {
          maxWidth: "700px",
          lineHeight: 1.1
        },
        children: [
          "Realtime monitoring",
          " ",
          /* @__PURE__ */ jsx("span", {
            style: { color: "var(--accent-9)" },
            children: "for your entire business"
          })
        ]
      }),
      /* @__PURE__ */ jsx(Text, {
        size: "4",
        color: "gray",
        style: { maxWidth: "550px" },
        children: "Track every inch of your product, monitor potential issues or opportunities, and respond by making data-driven decisions."
      }),
      /* @__PURE__ */ jsx(Box, { children: /* @__PURE__ */ jsx(Button, {
        size: "4",
        asChild: true,
        children: /* @__PURE__ */ jsx(Link, {
          to: "/signup",
          children: "Get started free"
        })
      }) })
    ]
  });
}
function Features() {
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gapY: "6",
    py: "9",
    children: [/* @__PURE__ */ jsxs(Flex, {
      direction: {
        initial: "column",
        md: "row"
      },
      justify: "between",
      align: "start",
      gap: "4",
      children: [/* @__PURE__ */ jsx(Heading, {
        size: "8",
        style: { maxWidth: "400px" },
        children: "Made for modern product teams"
      }), /* @__PURE__ */ jsx(Text, {
        size: "4",
        color: "gray",
        style: { maxWidth: "400px" },
        children: "Everything you need to monitor your product events in real-time, from ingestion to visualization."
      })]
    }), /* @__PURE__ */ jsx(Grid, {
      columns: {
        initial: "1",
        md: "3"
      },
      gap: "4",
      children: [
        {
          icon: "\u{1F3AF}",
          title: "Purpose built",
          desc: "Designed specifically for modern product teams who need real-time event tracking"
        },
        {
          icon: "\u26A1",
          title: "Lightning quick",
          desc: "Get real-time insights in milliseconds with our high-performance event pipeline"
        },
        {
          icon: "\u{1F4B0}",
          title: "10,000 events free",
          desc: "Start monitoring with a generous free tier, no credit card required"
        }
      ].map((feature, index) => /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          py: "2",
          children: [
            /* @__PURE__ */ jsx(Text, {
              size: "6",
              children: feature.icon
            }),
            /* @__PURE__ */ jsx(Heading, {
              size: "4",
              children: feature.title
            }),
            /* @__PURE__ */ jsx(Text, {
              size: "2",
              color: "gray",
              children: feature.desc
            })
          ]
        })
      }, index))
    })]
  });
}
function Testimonials() {
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gapY: "6",
    py: "9",
    align: "center",
    children: [/* @__PURE__ */ jsx(Heading, {
      size: "8",
      children: "What our customers say"
    }), /* @__PURE__ */ jsx(Grid, {
      columns: {
        initial: "1",
        md: "2"
      },
      gap: "4",
      style: { maxWidth: "800px" },
      children: [{
        name: "John Doe",
        role: "CTO, TechCorp",
        content: "This tool has revolutionized how we monitor our products. The real-time dashboards are exactly what we needed."
      }, {
        name: "Jane Smith",
        role: "Product Manager, InnovateCo",
        content: "The insights we've gained have been invaluable for our decision-making process. Setup took minutes."
      }].map((testimonial, index) => /* @__PURE__ */ jsx(Card, {
        size: "2",
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          children: [
            /* @__PURE__ */ jsxs(Text, {
              size: "3",
              style: { fontStyle: "italic" },
              children: [
                "\u201C",
                testimonial.content,
                "\u201D"
              ]
            }),
            /* @__PURE__ */ jsx(Separator, { size: "4" }),
            /* @__PURE__ */ jsxs(Flex, {
              align: "center",
              gap: "3",
              children: [/* @__PURE__ */ jsx(Avatar, {
                fallback: testimonial.name[0],
                size: "2"
              }), /* @__PURE__ */ jsxs(Box, { children: [
                /* @__PURE__ */ jsx(Text, {
                  weight: "bold",
                  size: "2",
                  children: testimonial.name
                }),
                /* @__PURE__ */ jsx("br", {}),
                /* @__PURE__ */ jsx(Text, {
                  size: "1",
                  color: "gray",
                  children: testimonial.role
                })
              ] })]
            })
          ]
        })
      }, index))
    })]
  });
}
function Pricing() {
  return /* @__PURE__ */ jsxs(Flex, {
    direction: "column",
    gapY: "6",
    py: "9",
    align: "center",
    children: [/* @__PURE__ */ jsxs(Box, {
      style: { textAlign: "center" },
      children: [/* @__PURE__ */ jsx(Heading, {
        size: "8",
        mb: "2",
        children: "Simple, transparent pricing"
      }), /* @__PURE__ */ jsx(Text, {
        size: "3",
        color: "gray",
        children: "Start free, scale as you grow"
      })]
    }), /* @__PURE__ */ jsx(Grid, {
      columns: {
        initial: "1",
        md: "3"
      },
      gap: "4",
      style: { maxWidth: "900px" },
      children: [
        {
          name: "Starter",
          price: "$9",
          features: [
            "Up to 50,000 events",
            "5 team members",
            "Basic analytics"
          ],
          highlighted: false
        },
        {
          name: "Pro",
          price: "$29",
          features: [
            "Up to 500,000 events",
            "Unlimited team members",
            "Advanced analytics",
            "Priority support"
          ],
          highlighted: true
        },
        {
          name: "Enterprise",
          price: "Custom",
          features: [
            "Unlimited events",
            "Dedicated account manager",
            "Custom integrations",
            "24/7 support"
          ],
          highlighted: false
        }
      ].map((plan, index) => /* @__PURE__ */ jsx(Card, {
        size: "3",
        style: plan.highlighted ? { border: "2px solid var(--accent-9)" } : {},
        children: /* @__PURE__ */ jsxs(Flex, {
          direction: "column",
          gap: "3",
          children: [
            /* @__PURE__ */ jsx(Text, {
              size: "2",
              weight: "bold",
              color: "gray",
              children: plan.name
            }),
            /* @__PURE__ */ jsxs(Flex, {
              align: "end",
              gap: "1",
              children: [/* @__PURE__ */ jsx(Heading, {
                size: "8",
                children: plan.price
              }), plan.price !== "Custom" && /* @__PURE__ */ jsx(Text, {
                size: "2",
                color: "gray",
                style: { marginBottom: "8px" },
                children: "/mo"
              })]
            }),
            /* @__PURE__ */ jsx(Separator, { size: "4" }),
            /* @__PURE__ */ jsx(Flex, {
              direction: "column",
              gap: "2",
              children: plan.features.map((feature, i) => /* @__PURE__ */ jsxs(Flex, {
                align: "center",
                gap: "2",
                children: [/* @__PURE__ */ jsx(Text, {
                  size: "2",
                  color: "green",
                  children: "&check;"
                }), /* @__PURE__ */ jsx(Text, {
                  size: "2",
                  children: feature
                })]
              }, i))
            }),
            /* @__PURE__ */ jsx(Button, {
              mt: "2",
              variant: plan.highlighted ? "solid" : "outline",
              size: "3",
              asChild: true,
              children: /* @__PURE__ */ jsx(Link, {
                to: "/signup",
                children: plan.price === "Custom" ? "Contact sales" : "Get started"
              })
            })
          ]
        })
      }, index))
    })]
  });
}
function Footer() {
  return /* @__PURE__ */ jsx(Flex, {
    justify: "between",
    align: "center",
    py: "6",
    mt: "4",
    style: { borderTop: "1px solid var(--gray-a5)" },
    asChild: true,
    children: /* @__PURE__ */ jsx("footer", { children: /* @__PURE__ */ jsx(Text, {
      size: "2",
      color: "gray",
      children: "\xA9 2024 Raterlog. All rights reserved."
    }) })
  });
}

export { Home as component };
//# sourceMappingURL=routes-BvhRYL8u.mjs.map
