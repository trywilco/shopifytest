import qrcode from "qrcode";
import db from "../db.server";

// [START get-qrcode]
export async function getQRCode(id, graphql) {
  const QRCode = await db.qRCode.findFirst({ where: { id } });

  if (!QRCode) {
    return null;
  }

  return supplementQRCode(QRCode, graphql);
}

export async function getQRCodes(shop, graphql) {
  const QRCodes = await db.qRCode.findMany({
    where: { shop },
    orderBy: { id: "desc" },
  });

  if (!QRCodes.length) {
    return QRCodes;
  }

  return Promise.all(
    QRCodes.map(async (QRCode) => supplementQRCode(QRCode, graphql))
  );
}
// [END get-qrcode]

// [START get-qrcode-image]
export async function getQRCodeImage(id) {
  const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
  const image = await qrcode.toBuffer(url.href);

  return `data:image/jpeg;base64, ${image.toString("base64")}`;
}
// [END get-qrcode-image]

// [START get-destination]
export function getDestinationUrl(QRCode) {
  if (QRCode.destination === "product") {
    return `https://${QRCode.shop}/products/${QRCode.productHandle}`;
  }

  const id = QRCode.productVariantId.replace(
    /gid:\/\/shopify\/ProductVariant\/([0-9]+)/,
    "$1"
  );

  return `https://${QRCode.shop}/cart/${id}:1`;
}
// [END get-destination]

// [START hydrate-qrcode]
async function supplementQRCode(QRCode, graphql) {
  const response = await graphql(
    `
      query supplementQRCode($id: ID!) {
        product(id: $id) {
          title
          images(first: 1) {
            nodes {
              altText
              url
            }
          }
        }
      }
    `,
    {
      variables: {
        id: QRCode.productId,
      },
    }
  );

  const {
    data: { product },
  } = await response.json();

  return {
    ...QRCode,
    productDeleted: !product?.title,
    productTitle: product?.title,
    productImage: product?.images?.nodes[0]?.url,
    productAlt: product?.images?.nodes[0]?.altText,
    destinationUrl: getDestinationUrl(QRCode),
    image: await getQRCodeImage(QRCode.id),
  };
}
// [END hydrate-qrcode]

// [START validate-qrcode]
export function validateQRCode(data) {
  const errors = {};

  if (!data.title) {
    errors.title = "Title is required";
  }

  if (!data.productId) {
    errors.productId = "Product is required";
  }

  if (!data.destination) {
    errors.destination = "Destination is required";
  }

  if (Object.keys(errors).length) {
    return errors;
  }
}
// [END validate-qrcode]
