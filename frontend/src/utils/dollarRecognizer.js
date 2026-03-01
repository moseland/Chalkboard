/**
 * The $1 Unistroke Recognizer (JavaScript version)
 *
 *  Jacob O. Wobbrock, Ph.D.
 *  The Information School
 *  University of Washington
 *  Seattle, WA 98195-2840
 *  wobbrock@uw.edu
 *
 *  Andrew D. Wilson, Ph.D.
 *  Microsoft Research
 *  One Microsoft Way
 *  Redmond, WA 98052
 *  awilson@microsoft.com
 *
 *  Yang Li, Ph.D.
 *  Department of Computer Science and Engineering
 *  University of Washington
 *  Seattle, WA 98195-2350
 *  yangli@cs.washington.edu
 */

// Point class
class Point {
    constructor(x, y) {
        this.X = x;
        this.Y = y;
    }
}

// Rectangle class
class Rectangle {
    constructor(x, y, width, height) {
        this.X = x;
        this.Y = y;
        this.Width = width;
        this.Height = height;
    }
}

// Result class
export class Result {
    constructor(name, score, ms, bounds) {
        this.Name = name;
        this.Score = score;
        this.Time = ms;
        this.Bounds = bounds;
    }
}

// Template class
class Template {
    constructor(name, points) {
        this.Name = name;
        this.Points = Resample(points, NumPoints);
        const radians = IndicativeAngle(this.Points);
        this.Points = RotateBy(this.Points, -radians);
        this.Points = ScaleTo(this.Points, SquareSize);
        this.Points = TranslateTo(this.Points, Origin);
    }
}

// Constants
const NumPoints = 64;
const SquareSize = 250.0;
const Origin = new Point(0, 0);
const Diagonal = Math.sqrt(SquareSize * SquareSize + SquareSize * SquareSize);
const HalfDiagonal = 0.5 * Diagonal;
const AngleRange = Deg2Rad(45.0);
const AnglePrecision = Deg2Rad(2.0);
const Phi = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden Ratio

// Recognition Functions
export class DollarRecognizer {
    constructor() {
        this.Unistrokes = [];

        // Base templates for Geometric Snapping

        // CIRCLE (Drawn counter-clockwise)
        const circlePoints = [];
        for (let i = 0; i < 64; i++) {
            const angle = (2 * Math.PI * i) / 64;
            circlePoints.push(new Point(100 * Math.cos(angle) + 100, 100 * Math.sin(angle) + 100));
        }
        this.AddTemplate("circle", circlePoints);

        // RECTANGLE (Drawn clockwise from top-left)
        const rectPoints = [];
        for (let x = 0; x < 100; x += 5) rectPoints.push(new Point(x, 0));
        for (let y = 0; y < 100; y += 5) rectPoints.push(new Point(100, y));
        for (let x = 100; x > 0; x -= 5) rectPoints.push(new Point(x, 100));
        for (let y = 100; y > 0; y -= 5) rectPoints.push(new Point(0, y));
        this.AddTemplate("rectangle", rectPoints);

        // RECTANGLE (Drawn counter-clockwise from top-left)
        const rectPointsCC = [];
        for (let y = 0; y < 100; y += 5) rectPointsCC.push(new Point(0, y));
        for (let x = 0; x < 100; x += 5) rectPointsCC.push(new Point(x, 100));
        for (let y = 100; y > 0; y -= 5) rectPointsCC.push(new Point(100, y));
        for (let x = 100; x > 0; x -= 5) rectPointsCC.push(new Point(x, 0));
        this.AddTemplate("rectangle", rectPointsCC);

        // TRIANGLE (Drawn clockwise from top vertex)
        const triPoints = [];
        for (let i = 0; i <= 50; i += 2) triPoints.push(new Point(50 + i, i * 2));
        for (let i = 0; i <= 100; i += 4) triPoints.push(new Point(100 - i, 100));
        for (let i = 0; i <= 50; i += 2) triPoints.push(new Point(i, 100 - i * 2));
        this.AddTemplate("triangle", triPoints);

        // TRIANGLE (Drawn counter-clockwise from top vertex)
        const triPointsCC = [];
        for (let i = 0; i <= 50; i += 2) triPointsCC.push(new Point(50 - i, i * 2));
        for (let i = 0; i <= 100; i += 4) triPointsCC.push(new Point(i, 100));
        for (let i = 0; i <= 50; i += 2) triPointsCC.push(new Point(100 - i, 100 - i * 2));
        this.AddTemplate("triangle", triPointsCC);
    }

    Recognize(rawPoints, useBoundedRotationInvariance) {
        if (rawPoints.length < 10) return new Result("No match", 0.0, 0, null);

        let t0 = Date.now();
        let points = [...rawPoints];

        // 1. Compute original bounding box before normalization so we can position the Konva shape identically
        const bounds = BoundingBox(points);

        // 2. Normalize
        points = Resample(points, NumPoints);
        let radians = IndicativeAngle(points);
        points = RotateBy(points, -radians);
        points = ScaleTo(points, SquareSize);
        points = TranslateTo(points, Origin);

        // 3. Match
        let b = +Infinity;
        let t = 0;
        for (let i = 0; i < this.Unistrokes.length; i++) {
            let d;
            if (useBoundedRotationInvariance) {
                d = DistanceAtBestAngle(points, this.Unistrokes[i], -AngleRange, +AngleRange, AnglePrecision);
            } else {
                d = DistanceAtBestAngle(points, this.Unistrokes[i], -Math.PI, +Math.PI, AnglePrecision);
            }
            if (d < b) {
                b = d;
                t = i;
            }
        }

        let t1 = Date.now();
        let score = 1.0 - (b / HalfDiagonal);

        if (score < 0.0) score = 0.0;

        if (this.Unistrokes.length === 0) return new Result("No match", 0.0, 0, bounds);

        return new Result(this.Unistrokes[t].Name, score, t1 - t0, bounds);
    }

    AddTemplate(name, points) {
        this.Unistrokes.push(new Template(name, points));
    }
}

// Math Utility Functions
function Resample(points, n) {
    let I = PathLength(points) / (n - 1);
    let D = 0.0;
    let newpoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
        let d = Distance(points[i - 1], points[i]);
        if ((D + d) >= I) {
            let qx = points[i - 1].X + ((I - D) / d) * (points[i].X - points[i - 1].X);
            let qy = points[i - 1].Y + ((I - D) / d) * (points[i].Y - points[i - 1].Y);
            let q = new Point(qx, qy);
            newpoints.push(q);
            points.splice(i, 0, q);
            D = 0.0;
        } else {
            D += d;
        }
    }
    if (newpoints.length === n - 1) {
        newpoints.push(new Point(points[points.length - 1].X, points[points.length - 1].Y));
    }
    return newpoints;
}

function IndicativeAngle(points) {
    let c = Centroid(points);
    return Math.atan2(c.Y - points[0].Y, c.X - points[0].X);
}

function RotateBy(points, radians) {
    let c = Centroid(points);
    let cos = Math.cos(radians);
    let sin = Math.sin(radians);
    let newpoints = [];
    for (let i = 0; i < points.length; i++) {
        let qx = (points[i].X - c.X) * cos - (points[i].Y - c.Y) * sin + c.X;
        let qy = (points[i].X - c.X) * sin + (points[i].Y - c.Y) * cos + c.Y;
        newpoints.push(new Point(qx, qy));
    }
    return newpoints;
}

function ScaleTo(points, size) {
    let B = BoundingBox(points);
    let newpoints = [];
    for (let i = 0; i < points.length; i++) {
        let qx = points[i].X * (size / B.Width);
        let qy = points[i].Y * (size / B.Height);
        newpoints.push(new Point(qx, qy));
    }
    return newpoints;
}

function TranslateTo(points, pt) {
    let c = Centroid(points);
    let newpoints = [];
    for (let i = 0; i < points.length; i++) {
        let qx = points[i].X + pt.X - c.X;
        let qy = points[i].Y + pt.Y - c.Y;
        newpoints.push(new Point(qx, qy));
    }
    return newpoints;
}

function DistanceAtBestAngle(points, T, a, b, threshold) {
    let x1 = Phi * a + (1.0 - Phi) * b;
    let f1 = DistanceAtAngle(points, T, x1);
    let x2 = (1.0 - Phi) * a + Phi * b;
    let f2 = DistanceAtAngle(points, T, x2);
    while (Math.abs(b - a) > threshold) {
        if (f1 < f2) {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = Phi * a + (1.0 - Phi) * b;
            f1 = DistanceAtAngle(points, T, x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = (1.0 - Phi) * a + Phi * b;
            f2 = DistanceAtAngle(points, T, x2);
        }
    }
    return Math.min(f1, f2);
}

function DistanceAtAngle(points, T, radians) {
    let newpoints = RotateBy(points, radians);
    return PathDistance(newpoints, T.Points);
}

function Centroid(points) {
    let x = 0.0, y = 0.0;
    for (let i = 0; i < points.length; i++) {
        x += points[i].X;
        y += points[i].Y;
    }
    x /= points.length;
    y /= points.length;
    return new Point(x, y);
}

function BoundingBox(points) {
    let minX = +Infinity, maxX = -Infinity, minY = +Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i].X);
        maxX = Math.max(maxX, points[i].X);
        minY = Math.min(minY, points[i].Y);
        maxY = Math.max(maxY, points[i].Y);
    }
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

function PathDistance(pts1, pts2) {
    let d = 0.0;
    for (let i = 0; i < pts1.length; i++) {
        d += Distance(pts1[i], pts2[i]);
    }
    return d / pts1.length;
}

function PathLength(points) {
    let d = 0.0;
    for (let i = 1; i < points.length; i++) {
        d += Distance(points[i - 1], points[i]);
    }
    return d;
}

function Distance(p1, p2) {
    let dx = p2.X - p1.X;
    let dy = p2.Y - p1.Y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Deg2Rad(d) { return (d * Math.PI / 180.0); }
