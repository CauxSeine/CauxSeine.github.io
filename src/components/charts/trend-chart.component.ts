import { Component, ElementRef, viewChild, effect, input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full w-full relative group">
      @if(title()) {
        <h4 class="text-sm font-bold text-slate-800 mb-2">{{ title() }}</h4>
      }
      
      <!-- Chart Container -->
      <div class="w-full h-64 bg-white rounded-lg relative" #chartContainer></div>

      <!-- Legend -->
      <div class="flex justify-center mt-2">
         <div class="flex items-center gap-2 text-xs text-slate-500">
            <span class="w-3 h-1" [style.background-color]="color()"></span>
            <span>Taux calculé sur inscrits</span>
         </div>
      </div>

      <!-- Tooltip (Hidden by default) -->
      <div #tooltip class="absolute z-10 pointer-events-none opacity-0 transition-opacity duration-200 bg-slate-800 text-white text-xs rounded px-3 py-2 shadow-xl transform -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap">
        <div class="font-bold text-indigo-100 mb-1 border-b border-indigo-700 pb-1" #tooltipLabel></div>
        <div class="text-white font-mono text-sm" #tooltipValue></div>
        <!-- Arrow -->
        <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
      </div>
    </div>
  `
})
export class TrendChartComponent implements OnDestroy {
  data = input.required<{ label: string; value: number }[]>();
  color = input<string>('#3b82f6');
  title = input<string>('');
  
  chartContainer = viewChild<ElementRef>('chartContainer');
  tooltip = viewChild<ElementRef>('tooltip');
  tooltipLabel = viewChild<ElementRef>('tooltipLabel');
  tooltipValue = viewChild<ElementRef>('tooltipValue');

  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: any = null;

  constructor() {
    effect(() => {
      // Trigger initialization when data or container is ready
      const data = this.data();
      const container = this.chartContainer();
      
      if (data.length > 0 && container) {
        this.initResizeObserver(container.nativeElement);
        // Attempt immediate draw
        this.scheduleDraw();
      }
    });
  }

  initResizeObserver(element: HTMLElement) {
    if (this.resizeObserver) return;
    
    this.resizeObserver = new ResizeObserver(() => {
       this.scheduleDraw();
    });
    this.resizeObserver.observe(element);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
    }
  }

  scheduleDraw() {
    // Debounce to prevent thrashing during resize
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
       requestAnimationFrame(() => this.drawChart());
    }, 100);
  }

  drawChart() {
    const element = this.chartContainer()?.nativeElement;
    // Check if element has dimensions
    if (!element || element.clientWidth === 0 || element.clientHeight === 0) return;

    // Clear previous SVG
    d3.select(element).selectAll('*').remove();

    // Increased bottom margin for rotated labels
    const margin = { top: 30, right: 30, bottom: 85, left: 50 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = element.clientHeight - margin.top - margin.bottom;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Axis Setup
    const allLabels = this.data().map(d => d.label);
    const x = d3.scalePoint()
      .domain(allLabels)
      .range([0, width])
      .padding(0.5);

    // Smart Tick Calculation: Prevent Overlap
    // Estimate each label takes ~25px horizontally when rotated/packed
    const minTickSpacing = 25; 
    const maxTicks = Math.floor(width / minTickSpacing);
    const step = Math.ceil(allLabels.length / maxTicks);
    
    // Filter labels to show only every Nth label
    const visibleLabels = allLabels.filter((_, i) => i % step === 0);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x)
        .tickValues(visibleLabels) // Only show filtered labels
        .tickSize(5)
      )
      .selectAll('text')
      .attr('class', 'text-[10px] text-slate-500 font-medium')
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)"); // More aggressive rotation for better readability
    
    // Y Axis
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(0))
      .selectAll('text')
      .attr('class', 'text-xs text-slate-400')
      .attr('x', -10);

    // Grid lines (horizontal)
    svg.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat(() => "")
      )
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.05)
      .selectAll("line")
      .attr("stroke", "#000");

    // Remove domain lines for cleaner look
    svg.selectAll(".domain").remove();

    // Y Axis Label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 15)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .attr('class', 'text-[10px] text-slate-400 uppercase tracking-wide')
      .text('Pourcentage (%)');

    // Gradient below the line
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "area-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
    
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", this.color())
        .attr("stop-opacity", 0.2);
    
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", this.color())
        .attr("stop-opacity", 0);

    // Line Generator
    const line = d3.line<{ label: string; value: number }>()
      .x(d => x(d.label)!)
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX); // Smooth curve

    // Area Generator
    const area = d3.area<{ label: string; value: number }>()
        .x(d => x(d.label)!)
        .y0(height)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

    // Vertical Guide Line (Hover cursor) - Initially hidden
    const focusLine = svg.append('line')
      .attr('class', 'focus-line')
      .attr('stroke', '#cbd5e1') // slate-300
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y1', 0)
      .attr('y2', height)
      .attr('opacity', 0);

    // Draw Line
    const path = svg.append('path')
      .datum(this.data())
      .attr('fill', 'none')
      .attr('stroke', this.color())
      .attr('stroke-width', 3)
      .attr('d', line)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    // Animation: Line Unfold
    const totalLength = path.node()!.getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // Draw Area with fade in
    svg.append("path")
        .datum(this.data())
        .attr("fill", "url(#area-gradient)")
        .attr("d", area)
        .attr("opacity", 0)
        .transition()
        .delay(500)
        .duration(1000)
        .attr("opacity", 1);


    // Visible Dots (Animated pop)
    const dots = svg.selectAll('.dot')
      .data(this.data())
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.label)!)
      .attr('cy', d => y(d.value))
      .attr('r', 0) // Start invisible
      .attr('fill', 'white')
      .attr('stroke', this.color())
      .attr('stroke-width', 2);

    dots.transition()
      .delay((d, i) => 800 + (i * 100))
      .duration(500)
      .attr('r', 4)
      .ease(d3.easeBackOut);

    // Interactive Overlay (Large invisible targets for easier hovering)
    const overlayDots = svg.selectAll('.overlay-dot')
        .data(this.data())
        .enter()
        .append('circle')
        .attr('cx', d => x(d.label)!)
        .attr('cy', d => y(d.value))
        .attr('r', 15) // Large hit area
        .attr('fill', 'transparent')
        .attr('class', 'cursor-pointer');

    // Tooltip Logic
    const tooltip = this.tooltip()?.nativeElement;
    const tooltipLabel = this.tooltipLabel()?.nativeElement;
    const tooltipValue = this.tooltipValue()?.nativeElement;

    overlayDots
        .on('mouseenter', (event, d) => {
           // Find the specific visual dot associated with this data point and enlarge it
           const index = this.data().indexOf(d);
           const currentX = x(d.label)!;

           // Show Guide Line
           focusLine
             .attr('x1', currentX)
             .attr('x2', currentX)
             .attr('opacity', 1);

           d3.select(dots.nodes()[index])
             .transition()
             .duration(200)
             .attr('r', 7)
             .attr('stroke-width', 3);
           
           if (tooltip) {
               tooltip.style.opacity = '1';
               tooltipLabel.textContent = d.label;
               tooltipValue.textContent = d.value.toFixed(1) + '%';
               
               // Calculate position relative to container
               const xPos = currentX + margin.left;
               const yPos = y(d.value) + margin.top;

               tooltip.style.left = `${xPos}px`;
               tooltip.style.top = `${yPos - 12}px`; // slightly above
           }
        })
        .on('mouseleave', (event, d) => {
           // Hide Guide Line
           focusLine.attr('opacity', 0);

           // Reset visual dot
           const index = this.data().indexOf(d);
           d3.select(dots.nodes()[index])
             .transition()
             .duration(200)
             .attr('r', 4)
             .attr('stroke-width', 2);

           if (tooltip) tooltip.style.opacity = '0';
        });
  }
}
